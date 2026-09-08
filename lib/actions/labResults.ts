'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const VALID_CATEGORIES = ['kan_tahlili', 'tomografi', 'rontgen', 'diger'];
const MAX_FILE_BYTES = 25 * 1024 * 1024;

function isAllowedFile(name: string, type: string) {
  const nameLower = name.toLowerCase();
  const isPdf = type === 'application/pdf' || nameLower.endsWith('.pdf');
  const isImage = type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(nameLower);
  // .docx: tomografi raporları artık düz Word belgesi olarak da
  // yüklenebiliyor — "📐 Şablona Uygula" adımı bunu okuyup Trakya Hayvan
  // Hastanesi şablonlu bir PDF'e çeviriyor (bkz. lib/actions/tomografi.ts).
  const isDocx =
    type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || nameLower.endsWith('.docx');
  return isPdf || isImage || isDocx;
}

// e-Klinik: kan tahlili, tomografi ve röntgen belgelerinin arşivi.
// Kasıtlı olarak sadece arşiv: laboratuvardan/radyolojiden çıkan PDF veya
// görüntü olduğu gibi 'lab-results' bucket'ına yüklenir ve lab_results
// tablosuna bir satır açılır. İçerik okunup ayrıştırılmaz (OCR yok) — hem
// personel hem (görünür işaretliyse) hasta sahibi aynı dosyayı görür,
// yanlış okunmuş bir değer riski hiç oluşmaz.
//
// Yükleme İKİ ADIMA bölünmüş durumda — bu kasıtlı ve tek adımlı halinden
// (dosyayı doğrudan bir Server Action'a POST etmek) daha karmaşık ama
// zorunlu: Vercel, Server Action'lara giden isteklerde next.config.js'teki
// `bodySizeLimit` ayarından TAMAMEN BAĞIMSIZ, platform seviyesinde kendi
// istek boyutu sınırını uyguluyor (yaklaşık 4-4.5MB). Bu sınır aşıldığında
// istek bizim kodumuza hiç ulaşmadan sessizce reddediliyor — kullanıcıya
// "hiçbir hata yok ama hiçbir şey de olmuyor" gibi görünmesinin sebebi bu.
// Telefonla çekilmiş bir röntgen/tomografi fotoğrafı ya da birden fazla
// sayfalı bir PDF çok kolay bu sınırı aşıyor.
//
// Çözüm: dosya baytları Vercel'den HİÇ geçmiyor.
//   1) createLabResultUploadTicket: sadece dosya adı/tipi/boyutu (birkaç
//      bayt) gönderilir, sunucu kısa ömürlü imzalı bir "yükleme bileti"
//      üretir (Supabase Storage createSignedUploadUrl). Bu adımda staff
//      yetkisi (is_staff RLS) kontrol edilir.
//   2) Tarayıcı, bu bileti kullanarak dosyayı DOĞRUDAN Supabase Storage'a
//      yükler (bkz. components/LabResultUploadForm.tsx) — Vercel'e hiç
//      uğramaz, dolayısıyla Vercel'in boyut sınırından etkilenmez.
//   3) finalizeLabResult: yükleme bittikten sonra çağrılır, sadece küçük
//      metin alanlarını (kategori/başlık/tarih) gönderir ve veritabanı
//      satırını oluşturur.
export async function createLabResultUploadTicket(
  patientId: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<{ path: string; token: string } | { error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Oturumunuz sona ermiş görünüyor. Lütfen sayfayı yenileyip tekrar giriş yapın.' };

  if (!fileName || !fileSize || fileSize <= 0) {
    return { error: 'Yüklenecek dosya seçilmedi.' };
  }
  if (!isAllowedFile(fileName, fileType)) {
    return { error: 'Sadece PDF, resim (JPG/PNG) veya Word (.docx) dosyası yükleyebilirsiniz.' };
  }
  if (fileSize > MAX_FILE_BYTES) {
    return { error: 'Dosya çok büyük (25 MB üzeri). Lütfen daha küçük bir dosya yükleyin.' };
  }

  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${patientId}/${Date.now()}-${safeName}`;

  const { data, error } = await supabase.storage.from('lab-results').createSignedUploadUrl(path);
  if (error || !data) {
    return { error: 'Yükleme başlatılamadı: ' + (error?.message ?? 'bilinmeyen hata') };
  }

  return { path: data.path, token: data.token };
}

export async function finalizeLabResult(
  patientId: string,
  input: { storagePath: string; fileName: string; category: string; title: string; takenAt: string }
): Promise<{ error: string } | { ok: true }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Oturumunuz sona ermiş görünüyor. Lütfen sayfayı yenileyip tekrar giriş yapın.' };

  if (!input.storagePath) return { error: 'Dosya yolu eksik — yükleme adımı tamamlanmamış olabilir.' };

  const category = String(input.category || 'kan_tahlili').trim();
  if (!VALID_CATEGORIES.includes(category)) return { error: 'Geçersiz belge türü.' };

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

  const title = String(input.title || '').trim() || (input.fileName || '').replace(/\.[a-zA-Z0-9]+$/i, '');
  const takenAt = String(input.takenAt || '').trim() || null;

  const { error: insertError } = await supabase.from('lab_results').insert({
    patient_id: patientId,
    category,
    title,
    file_name: input.fileName,
    storage_path: input.storagePath,
    taken_at: takenAt,
    uploaded_by: user.id,
    uploaded_by_name: profile?.full_name ?? 'Personel',
  });
  if (insertError) {
    // Dosya zaten Storage'a yüklendi ama satır oluşmadı — arşivde yetim bir
    // dosya kalması, hasta sahibine hiç görünmeyen bir kaydın sessizce
    // kaybolmasından daha zararsız, o yüzden burada silmeye uğraşmıyoruz.
    return { error: 'Kayıt oluşturulamadı: ' + insertError.message };
  }

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}

// Yanlışlıkla yüklenmiş bir dosyayı geri almak için — sadece giriş yapmış
// personel/admin çağırabilir (sayfa zaten oturum gerektiriyor), RLS da
// storage.objects ve lab_results tarafında aynı kuralı ayrıca uyguluyor.
export async function deleteLabResult(patientId: string, labResultId: string, storagePath: string) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  await supabase.storage.from('lab-results').remove([storagePath]);
  await supabase.from('lab_results').delete().eq('id', labResultId);

  revalidatePath(`/patients/${patientId}`);
}
