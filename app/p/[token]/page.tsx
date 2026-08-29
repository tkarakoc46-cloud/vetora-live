import { notFound } from 'next/navigation';
import { getPatientByToken } from '@/lib/owner';
import { createAdminClient } from '@/lib/supabase/admin';
import { sendOwnerMessage } from '@/lib/actions/ownerMessage';
import { OwnerLiveFeed } from '@/components/OwnerLiveFeed';
import { SubmitButton } from '@/components/SubmitButton';

export default async function OwnerView({ params }: { params: { token: string } }) {
  const patient = await getPatientByToken(params.token);
  if (!patient) notFound(); // an inactive/unknown token looks identical to a 404 — no information leak

  const supabase = createAdminClient();

  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('patient_id', patient.id)
    .eq('visible_to_owner', true)
    .order('created_at', { ascending: false })
    .limit(200);

  // Mint short-lived signed URLs for any photos in this batch — the
  // owner's browser never gets direct Storage access or a permanent URL.
  const withSignedUrls = await Promise.all(
    (records ?? []).map(async (r) => {
      if (r.type === 'photo' && r.payload?.storage_path) {
        const { data } = await supabase.storage
          .from('patient-photos')
          .createSignedUrl(r.payload.storage_path, 3600);
        return { ...r, signedUrl: data?.signedUrl };
      }
      return r;
    })
  );

  const { data: messages } = await supabase
    .from('messages')
    .select('*')
    .eq('patient_id', patient.id)
    .order('created_at', { ascending: true });

  const sendMessage = sendOwnerMessage.bind(null, params.token);

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="card p-4 mb-5">
        <h1 className="text-lg font-bold">{patient.name}</h1>
        <div className="text-xs text-text3">{patient.breed} · {patient.kennel_no}</div>
      </div>

      <OwnerLiveFeed token={params.token} initialRecords={withSignedUrls as any} initialStatus={patient.status} />

      <div className="text-xs font-bold text-text3 uppercase mb-2 no-print">Hastaneye Mesaj</div>
      <div className="card p-4 mb-3 bg-green-50 text-xs text-green no-print">
        Gönderdiğiniz mesajlar otomatik olarak hastanenin WhatsApp hattına iletilir.
      </div>
      <div className="card p-3 space-y-2 mb-3 max-h-80 overflow-y-auto no-print">
        {(messages ?? []).map((m) => (
          <div key={m.id} className={`text-sm ${m.sender_type === 'owner' ? 'text-right' : ''}`}>
            <span className="inline-block bg-surface2 rounded-lg px-3 py-1.5">{m.body}</span>
            {m.sender_type === 'owner' && (
              <div className="text-[10px] text-text3 mt-0.5">
                {m.whatsapp_forwarded ? '✓ WhatsApp’a iletildi' : 'İletiliyor…'}
              </div>
            )}
          </div>
        ))}
      </div>
      <form action={sendMessage} className="flex gap-2 no-print">
        <input name="body" placeholder="Mesajınızı yazın…" required className="flex-1 rounded-lg border border-border px-3 py-2 text-sm" />
        <SubmitButton className="btn-primary" pendingText="Gönderiliyor…">Gönder</SubmitButton>
      </form>
    </div>
  );
}
