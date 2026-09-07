'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

// Kasıtlı olarak sadece arşiv: laboratuvardan çıkan PDF olduğu gibi
// 'lab-results' bucket'ına yüklenir ve lab_results tablosuna bir satır
// açılır. İçerik okunup ayrıştırılmaz (OCR yok) — hem personel hem
// (görünür işaretliyse) hasta sahibi aynı dosyayı görür, yanlış okunmuş bir
// değer riski hiç oluşmaz.
export async function addLabResult(patientId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const file = formData.get('pdf') as File | null;
  if (!file || file.size === 0) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Yüklenecek PDF dosyası seçilmedi.')}`);
  }
  const looksLikePdf = file!.type === 'application/pdf' || file!.name.toLowerCase().endsWith('.pdf');
  if (!looksLikePdf) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Sadece PDF dosyası yükleyebilirsiniz.')}`);
  }
  if (file!.size > 20 * 1024 * 1024) {
    redirect(
      `/patients/${patientId}?error=${encodeURIComponent('Dosya çok büyük (20 MB üzeri). Lütfen daha küçük bir PDF yükleyin.')}`
    );
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const safeName = file!.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${patientId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('lab-results')
    .upload(path, file!, { contentType: 'application/pdf' });
  if (uploadError) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Dosya yüklenemedi: ' + uploadError.message)}`);
  }

  const title = String(formData.get('title') || '').trim() || file!.name.replace(/\.pdf$/i, '');
  const takenAt = String(formData.get('taken_at') || '').trim() || null;

  const { error: insertError } = await supabase.from('lab_results').insert({
    patient_id: patientId,
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
