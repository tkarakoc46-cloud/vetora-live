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
