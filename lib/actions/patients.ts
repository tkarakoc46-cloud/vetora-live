'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const STATUS_LABEL_TR: Record<string, string> = {
  stable: 'Stabil',
  improving: 'İyiye Gidiyor',
  watch: 'Yakın Takip',
  critical: 'Kritik',
};

export async function addPatient(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const name = String(formData.get('name') || '').trim();
  const species = String(formData.get('species') || '').trim();
  const owner_name = String(formData.get('owner_name') || '').trim();

  if (!name || !species || !owner_name) {
    redirect(`/patients/new?error=${encodeURIComponent('Hasta adı, tür ve hasta sahibinin adı zorunludur.')}`);
  }

  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      name,
      species,
      breed: String(formData.get('breed') || '').trim() || null,
      sex: String(formData.get('sex') || '').trim() || null,
      age_years: formData.get('age_years') ? Number(formData.get('age_years')) : null,
      kennel_no: String(formData.get('kennel_no') || '').trim() || null,
      owner_name,
      owner_phone: String(formData.get('owner_phone') || '').trim() || null,
      owner_email: String(formData.get('owner_email') || '').trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  // Any failure here (RLS denial, a missing DB extension, a bad column value,
  // etc.) must never surface as Next.js's generic "Application error: a
  // server-side exception has occurred" screen — that message hides the real
  // cause from both the user and us. Instead, send the actual database error
  // back to the form so it's visible immediately.
  if (error || !patient) {
    redirect(`/patients/new?error=${encodeURIComponent(error?.message ?? 'Hasta eklenemedi (bilinmeyen hata).')}`);
  }

  redirect(`/patients/${patient!.id}`);
}

// Any staff member can update a patient's headline status (Stabil / Yakın
// Takip / Kritik). We also drop a timeline entry for the change so the
// owner's live feed shows *when* it changed, not just the current value.
export async function updatePatientStatus(patientId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const status = String(formData.get('status') || '').trim();
  if (!['stable', 'improving', 'watch', 'critical'].includes(status)) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Geçersiz durum.')}`);
  }

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const { error } = await supabase.from('patients').update({ status, updated_at: new Date().toISOString() }).eq('id', patientId);
  if (error) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from('records').insert({
    patient_id: patientId,
    type: 'event',
    payload: { event: 'status_change', label: `Durum güncellendi: ${STATUS_LABEL_TR[status] ?? status}`, status },
    visible_to_owner: true,
    created_by: user!.id,
    created_by_name: profile?.full_name ?? 'Personel',
  });

  revalidatePath(`/patients/${patientId}`);
}

// Any staff member can discharge a patient — unlike deletion below, this is
// routine and non-destructive: records, photos and the owner's link all stay
// intact, the patient just moves out of the "Yatılı" (inpatient) list and
// into "Taburcu Edilmiş" on both the dashboard and the read-only all-patients
// panel. We also drop a timeline entry so the owner's live feed shows it.
export async function dischargePatient(patientId: string, _formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const { error } = await supabase
    .from('patients')
    .update({ discharged_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', patientId);
  if (error) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent(error.message)}`);
  }

  await supabase.from('records').insert({
    patient_id: patientId,
    type: 'event',
    payload: { event: 'discharged', label: 'Hasta taburcu edildi' },
    visible_to_owner: true,
    created_by: user!.id,
    created_by_name: profile?.full_name ?? 'Personel',
  });

  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/dashboard');
  revalidatePath('/patients');
  redirect(`/patients/${patientId}`);
}

// Recording a death: the single highest-stakes action in the app. Stores a
// precise, editable time of death (staff often log this a few minutes after
// the fact, not at the exact instant it happened) in its own `deceased_at`
// column — deliberately kept separate from `discharged_at` so a deceased
// patient shows up in its own "Vefat Eden" list rather than being lumped in
// with routine discharges. The event itself defaults to staff-only
// (visible_to_owner: false): a family should hear this in person or by
// phone, not discover it by refreshing the tracking link.
export async function markPatientDeceased(patientId: string, formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const deathTimeLocal = String(formData.get('death_time') || '').trim();
  // Turkey has used a fixed UTC+3 offset (no DST) since 2016, so a
  // datetime-local value — always entered as Turkey wall-clock time by
  // staff physically at the clinic — converts to the correct UTC instant by
  // attaching that fixed offset directly, regardless of the server's own
  // timezone.
  const deceasedAt = deathTimeLocal ? new Date(`${deathTimeLocal}:00+03:00`) : new Date();
  if (isNaN(deceasedAt.getTime())) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Geçersiz ölüm tarihi/saati.')}`);
  }

  const { error } = await supabase
    .from('patients')
    .update({ deceased_at: deceasedAt.toISOString(), updated_at: new Date().toISOString() })
    .eq('id', patientId);
  if (error) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent(error.message)}`);
  }

  const note = String(formData.get('note') || '').trim();
  await supabase.from('records').insert({
    patient_id: patientId,
    type: 'event',
    payload: { event: 'deceased', label: 'Hasta EX oldu', death_time: deceasedAt.toISOString(), note },
    visible_to_owner: false,
    created_by: user!.id,
    created_by_name: profile?.full_name ?? 'Personel',
  });

  revalidatePath(`/patients/${patientId}`);
  revalidatePath('/dashboard');
  revalidatePath('/patients');
  revalidatePath('/admin');
  redirect(`/patients/${patientId}`);
}

// Admin-only, irreversible: wipes a patient and everything tied to it —
// timeline records, messages, daily tasks (all ON DELETE CASCADE at the DB
// level) plus its uploaded photos in Storage, which have no such cascade
// and must be cleared explicitly. Uses the service-role client for the
// destructive step, but only after independently confirming (server-side,
// via the caller's own session) that they hold the ADMIN role — the button
// that triggers this is also hidden from non-admins in the UI, but that's
// a convenience, not the security boundary.
export async function deletePatient(patientId: string, _formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user!.id).single();
  if (profile?.role !== 'ADMIN') {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Bu işlemi sadece yönetici yapabilir.')}`);
  }

  const admin = createAdminClient();

  const { data: patient } = await admin.from('patients').select('name').eq('id', patientId).single();

  // Best-effort audit trail: kept even after the patient row (and its FK)
  // is gone, since audit_log.patient_id is ON DELETE SET NULL.
  await admin.from('audit_log').insert({
    actor_profile_id: user!.id,
    actor_name: profile?.full_name ?? 'Yönetici',
    action: 'delete_patient',
    patient_id: patientId,
    detail: `Hasta silindi: ${patient?.name ?? patientId}`,
  });

  const { data: files } = await admin.storage.from('patient-photos').list(patientId);
  if (files && files.length > 0) {
    await admin.storage.from('patient-photos').remove(files.map((f) => `${patientId}/${f.name}`));
  }

  const { error } = await admin.from('patients').delete().eq('id', patientId);
  if (error) {
    redirect(`/patients/${patientId}?error=${encodeURIComponent('Silinemedi: ' + error.message)}`);
  }

  redirect('/admin');
}
