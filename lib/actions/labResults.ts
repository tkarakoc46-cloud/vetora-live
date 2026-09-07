'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const VALID_CATEGORIES = ['kan_tahlili', 'tomografi', 'rontgen', 'diger'];

// e-Klinik: kan tahlili, tomografi ve röntgen belgelerinin arşivi.
// Kasıtlı olarak sadece arşiv: laboratuvardan/radyolojiden çıkan PDF veya
// görüntü olduğu gibi 'lab-results' bucket'ına yüklenir ve lab_results
// tablosuna bir satır açılır. İçerik okunup ayrıştırılmaz (OCR yok) — hem
// personel hem (görünür işaretliyse) hasta sahibi aynı dosyayı görür,
// yanlış okunmuş bir değer riski hiç oluşmaz.
export async function addLabResult(patientId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const file = formData.get('file') as File | null;
  if (!file || file.size === 0) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Yüklenecek dosya seçilmedi.')}`);
  }
  const nameLower = file!.name.toLowerCase();
  const isPdf = file!.type === 'application/pdf' || nameLower.endsWith('.pdf');
  const isImage = file!.type.startsWith('image/') || /\.(jpe?g|png|webp|heic)$/i.test(nameLower);
  if (!isPdf && !isImage) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Sadece PDF veya resim (JPG/PNG) dosyası yükleyebilirsiniz.')}`);
  }
  if (file!.size > 25 * 1024 * 1024) {
    redirect(
      `/patients/${patientId}?error=${encodeURIComponent('Dosya çok büyük (25 MB üzeri). Lütfen daha küçük bir dosya yükleyin.')}`
    );
  }

  const category = String(formData.get('category') || 'kan_tahlili').trim();
  if (!VALID_CATEGORIES.includes(category)) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Geçersiz belge türü.')}`);
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const safeName = file!.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${patientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('lab-results')
    .upload(path, file!, { contentType: file!.type || (isPdf ? 'application/pdf' : 'application/octet-stream') });
  if (uploadError) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Dosya yüklenemedi: ' + uploadError.message)}`);
  }

  const title = String(formData.get('title') || '').trim() || file!.name.replace(/\.[a-zA-Z0-9]+$/i, '');
  const takenAt = String(formData.get('taken_at') || '').trim() || null;

  const { error: insertError } = await supabase.from('lab_results').insert({
    patient_id: patientId,
    category,
    title,
    file_name: file!.name,
    storage_path: path,
    taken_at: takenAt,
    uploaded_by: user!.id,
    uploaded_by_name: profile?.full_name ?? 'Personel',
  });
  if (insertError) {
    // Dosya zaten Storage'a yüklendi ama satır oluşmadı — arşivde yetim bir
    // dosya kalması, hasta sahibine hiç görünmeyen bir kaydın sessizce
    // kaybolmasından daha zararsız, o yüzden burada silmeye uğraşmıyoruz.
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Kayıt oluşturulamadı: ' + insertError.message)}`);
  }

  revalidatePath(`/patients/${patientId}`);
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
