'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

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
