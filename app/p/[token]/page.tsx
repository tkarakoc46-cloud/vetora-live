import { notFound } from 'next/navigation';
import { getPatientByToken } from '@/lib/owner';
import { createAdminClient } from '@/lib/supabase/admin';
import { OwnerLiveFeed } from '@/components/OwnerLiveFeed';
import { OwnerTabs } from '@/components/OwnerTabs';
import { WhatsAppContact } from '@/components/WhatsAppContact';

function formatDateOnly(dateStr: string) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function formatIstanbul(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default async function OwnerView({ params }: { params: { token: string } }) {
  const patient = await getPatientByToken(params.token);
  if (!patient) notFound(); // an inactive/unknown token looks identical to a 404 — no information leak

  const supabase = createAdminClient();
  const isInpatient = patient.patient_kind !== 'outpatient';

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

  const { data: labResultRows } = await supabase
    .from('lab_results')
    .select('*')
    .eq('patient_id', patient.id)
    .eq('visible_to_owner', true)
    .order('created_at', { ascending: false });

  const labResults = await Promise.all(
    (labResultRows ?? []).map(async (l) => {
      const { data } = await supabase.storage.from('lab-results').createSignedUrl(l.storage_path, 3600);
      return { ...l, signedUrl: data?.signedUrl };
    })
  );

  const labPanel = (
    <div className="card divide-y divide-border">
      {labResults.map((l) => (
        <a
          key={l.id}
          href={l.signedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 p-3.5 hover:bg-surface2"
        >
          <span className="text-lg">📄</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{l.title}</div>
            <div className="text-xs text-text3">
              {l.taken_at ? formatDateOnly(l.taken_at) : formatIstanbul(l.created_at)}
            </div>
          </div>
        </a>
      ))}
      {labResults.length === 0 && (
        <div className="p-6 text-center text-sm text-text3">Henüz yüklenmiş tahlil sonucu yok.</div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex items-center justify-center gap-2 mb-4 no-print">
        <img src="/logo-header.png" alt="Börü Care" className="h-8 w-8" />
        <span className="font-display font-bold text-sm">Börü Care</span>
      </div>

      <div className="card p-4 mb-5">
        <h1 className="text-lg font-bold">{patient.name}</h1>
        <div className="text-xs text-text3">
          {patient.breed} · {isInpatient ? patient.kennel_no : 'Poliklinik / Tahlil'}
        </div>
      </div>

      {isInpatient ? (
        <OwnerTabs
          takip={
            <OwnerLiveFeed token={params.token} initialRecords={withSignedUrls as any} initialStatus={patient.status} />
          }
          lab={labPanel}
          labCount={labResults.length}
        />
      ) : (
        <div>
          <div className="text-xs font-bold text-text3 uppercase mb-2">Laboratuvar Sonuçları</div>
          {labPanel}
        </div>
      )}

      <WhatsAppContact
        hospitalNumber={process.env.WHATSAPP_HOSPITAL_NUMBER || ''}
        patientName={patient.name}
      />
    </div>
  );
}
