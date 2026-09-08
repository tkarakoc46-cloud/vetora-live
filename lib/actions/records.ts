'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function currentStaff() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum bulunamadı.');
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();
  return { supabase, userId: user.id, name: profile?.full_name ?? 'Personel' };
}

export async function addVitalRecord(patientId: string, formData: FormData) {
  const { supabase, userId, name } = await currentStaff();
  await supabase.from('records').insert({
    patient_id: patientId,
    type: 'vital',
    payload: {
      temp_c: Number(formData.get('temp_c')) || null,
      pulse_bpm: Number(formData.get('pulse_bpm')) || null,
      resp_rpm: Number(formData.get('resp_rpm')) || null,
      note: String(formData.get('note') || ''),
    },
    visible_to_owner: true,
    created_by: userId,
    created_by_name: name,
  });
  revalidatePath(`/patients/${patientId}`);
}

// Quick one-tap events for the moments an owner most wants to know about in
// real time: taken into / out of surgery, anesthesia given / recovered
// from. Reuses the record_type 'event' (see supabase/schema.sql migration
// note) so these show up inline in the same timeline/live feed as
// everything else, clearly labeled.
const EVENT_LABELS: Record<string, string> = {
  surgery_start: 'Ameliyata Alındı',
  surgery_end: 'Ameliyattan Çıktı',
  anesthesia_start: 'Anestezi Verildi',
  anesthesia_end: 'Anesteziden Uyandı',
  xray: 'Röntgen Çekildi',
  blood_drawn: 'Kan Alındı',
  blood_results: 'Kan Sonuçları Çıktı',
  serum: 'Serum Verildi',
  injection: 'Enjeksiyon Yapıldı',
};

export async function addEventRecord(patientId: string, formData: FormData) {
  const { supabase, userId, name } = await currentStaff();
  const event = String(formData.get('event') || '');
  const label = EVENT_LABELS[event];
  if (!label) throw new Error('Geçersiz olay.');

  await supabase.from('records').insert({
    patient_id: patientId,
    type: 'event',
    payload: { event, label, note: String(formData.get('note') || '') },
    visible_to_owner: true,
    created_by: userId,
    created_by_name: name,
  });
  revalidatePath(`/patients/${patientId}`);
}

export async function addSurgeryRecord(patientId: string, formData: FormData) {
  const { supabase, userId, name } = await currentStaff();
  await supabase.from('records').insert({
    patient_id: patientId,
    type: 'surgery',
    payload: {
      procedure: String(formData.get('procedure') || ''),
      surgeon: String(formData.get('surgeon') || ''),
      anesthesia: String(formData.get('anesthesia') || ''),
      duration_min: Number(formData.get('duration_min')) || null,
      outcome: String(formData.get('outcome') || ''),
      postop_note: String(formData.get('postop_note') || ''),
    },
    visible_to_owner: true,
    created_by: userId,
    created_by_name: name,
  });
  revalidatePath(`/patients/${patientId}`);
}

export async function addNoteRecord(patientId: string, formData: FormData) {
  const { supabase, userId, name } = await currentStaff();
  await supabase.from('records').insert({
    patient_id: patientId,
    type: 'note',
    payload: { text: String(formData.get('text') || '') },
    visible_to_owner: formData.get('visible_to_owner') === 'on',
    created_by: userId,
    created_by_name: name,
  });
  revalidatePath(`/patients/${patientId}`);
}

// Real, instant photo capture: the file is uploaded straight to Supabase
// Storage (private bucket `patient-photos`), and a `records` row of type
// 'photo' points at it. Because the owner view (app/p/[token]/page.tsx)
// re-reads this table on every request (and can be wired to Supabase
// Realtime for a live-updating feed), the owner sees it moments after
// it's taken — no polling or manual refresh needed on the clinic's side.
//
// Aynı iki-adımlı yükleme deseni (bkz. lib/actions/labResults.ts'teki uzun
// açıklama): telefon kamerasından çekilen bir fotoğraf çok kolay Vercel'in
// Server Action'lar için uyguladığı ~4.5MB'lık platform sınırını aşıyor —
// next.config.js'teki bodySizeLimit ayarı bu sınırı etkilemiyor. Bu yüzden
// dosya baytları artık Vercel'den hiç geçmiyor: önce imzalı bir yükleme
// bileti alınıyor, tarayıcı dosyayı doğrudan Supabase Storage'a yüklüyor,
// sonra küçük bir ikinci çağrıyla veritabanı satırı oluşturuluyor.
export async function createPhotoUploadTicket(
  patientId: string,
  fileName: string,
  fileType: string,
  fileSize: number
): Promise<{ path: string; token: string } | { error: string }> {
  const { supabase } = await currentStaff();

  if (!fileName || !fileSize || fileSize <= 0) return { error: 'Fotoğraf seçilmedi.' };
  if (!fileType.startsWith('image/') && !/\.(jpe?g|png|webp|heic)$/i.test(fileName.toLowerCase())) {
    return { error: 'Sadece resim dosyası yükleyebilirsiniz.' };
  }
  if (fileSize > 25 * 1024 * 1024) {
    return { error: 'Dosya çok büyük (25 MB üzeri). Lütfen daha küçük bir dosya yükleyin.' };
  }

  const ext = fileName.split('.').pop() || 'jpg';
  const path = `${patientId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage.from('patient-photos').createSignedUploadUrl(path);
  if (error || !data) {
    return { error: 'Yükleme başlatılamadı: ' + (error?.message ?? 'bilinmeyen hata') };
  }
  return { path: data.path, token: data.token };
}

export async function finalizePhotoRecord(
  patientId: string,
  input: { storagePath: string; caption: string; visibleToOwner: boolean }
): Promise<{ error: string } | { ok: true }> {
  const { supabase, userId, name } = await currentStaff();
  if (!input.storagePath) return { error: 'Dosya yolu eksik — yükleme adımı tamamlanmamış olabilir.' };

  const { error } = await supabase.from('records').insert({
    patient_id: patientId,
    type: 'photo',
    payload: { storage_path: input.storagePath, caption: input.caption || '' },
    visible_to_owner: input.visibleToOwner,
    created_by: userId,
    created_by_name: name,
  });
  if (error) return { error: 'Kayıt oluşturulamadı: ' + error.message };

  revalidatePath(`/patients/${patientId}`);
  return { ok: true };
}
