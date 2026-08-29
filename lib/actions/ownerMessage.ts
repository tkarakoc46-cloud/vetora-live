'use server';

import { revalidatePath } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { getPatientByToken } from '@/lib/owner';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function sendOwnerMessage(token: string, formData: FormData) {
  const patient = await getPatientByToken(token);
  if (!patient) throw new Error('Geçersiz bağlantı.');

  const body = String(formData.get('body') || '').trim();
  if (!body) return;

  const supabase = createAdminClient();

  // 1) Always store the message immediately — the owner's chat history
  //    must never depend on WhatsApp being reachable.
  const { data: message } = await supabase
    .from('messages')
    .insert({
      patient_id: patient.id,
      sender_type: 'owner',
      sender_name: patient.owner_name,
      body,
    })
    .select()
    .single();

  // 2) Forward to the clinic's WhatsApp number in real time.
  const waText = `📩 Vetora Live — ${patient.name} (${patient.owner_name}):\n${body}`;
  const result = await sendWhatsAppMessage(waText);

  if (message) {
    await supabase
      .from('messages')
      .update(
        result.ok
          ? { whatsapp_forwarded: true, whatsapp_message_id: result.messageId }
          : { whatsapp_forwarded: false, whatsapp_error: result.error }
      )
      .eq('id', message.id);
  }

  revalidatePath(`/p/${token}`);
}
