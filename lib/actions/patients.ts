'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function addPatient(formData: FormData) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Oturum bulunamadı.');

  const { data: patient, error } = await supabase
    .from('patients')
    .insert({
      name: String(formData.get('name') || '').trim(),
      species: String(formData.get('species') || '').trim(),
      breed: String(formData.get('breed') || '').trim() || null,
      sex: String(formData.get('sex') || '').trim() || null,
      age_years: formData.get('age_years') ? Number(formData.get('age_years')) : null,
      kennel_no: String(formData.get('kennel_no') || '').trim() || null,
      owner_name: String(formData.get('owner_name') || '').trim(),
      owner_phone: String(formData.get('owner_phone') || '').trim() || null,
      owner_email: String(formData.get('owner_email') || '').trim() || null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !patient) {
    throw new Error(error?.message ?? 'Hasta eklenemedi.');
  }

  redirect(`/patients/${patient.id}`);
}
