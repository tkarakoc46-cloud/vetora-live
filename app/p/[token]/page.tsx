import { notFound } from 'next/navigation';
import { getPatientByToken } from '@/lib/owner';
import { createAdminClient } from '@/lib/supabase/admin';
import { OwnerLiveFeed } from '@/components/OwnerLiveFeed';
import { WhatsAppContact } from '@/components/WhatsAppContact';

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

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex items-center justify-center gap-2 mb-4 no-print">
        <img src="/logo-header.png" alt="Börü Care" className="h-8 w-8" />
        <span className="font-display font-bold text-sm">Börü Care</span>
      </div>

      <div className="card p-4 mb-5">
        <h1 className="text-lg font-bold">{patient.name}</h1>
        <div className="text-xs text-text3">{patient.breed} · {patient.kennel_no}</div>
      </div>

      <OwnerLiveFeed token={params.token} initialRecords={withSignedUrls as any} initialStatus={patient.status} />

      <WhatsAppContact
        hospitalNumber={process.env.WHATSAPP_HOSPITAL_NUMBER || ''}
        patientName={patient.name}
      />
    </div>
  );
}
