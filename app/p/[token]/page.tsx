import { notFound } from 'next/navigation';
import { getPatientByToken } from '@/lib/owner';
import { createAdminClient } from '@/lib/supabase/admin';
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

const CATEGORY_LABEL: Record<string, string> = {
  kan_tahlili: 'Kan Tahlili',
  tomografi: 'Tomografi',
  rontgen: 'Röntgen',
  diger: 'Diğer',
};
const CATEGORY_ICON: Record<string, string> = {
  kan_tahlili: '🩸',
  tomografi: '🧲',
  rontgen: '🩻',
  diger: '📄',
};

export default async function OwnerView({ params }: { params: { token: string } }) {
  const patient = await getPatientByToken(params.token);
  if (!patient) notFound(); // an inactive/unknown token looks identical to a 404 — no information leak

  const supabase = createAdminClient();

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
          <span className="text-lg">{CATEGORY_ICON[l.category] ?? '📄'}</span>
          <div className="flex-1 min-w-0">
            <div className="font-bold text-sm truncate">{l.title}</div>
            <div className="text-xs text-text3">
              {CATEGORY_LABEL[l.category] ?? 'Diğer'} · {l.taken_at ? formatDateOnly(l.taken_at) : formatIstanbul(l.created_at)}
            </div>
          </div>
        </a>
      ))}
      {labResults.length === 0 && (
        <div className="p-6 text-center text-sm text-text3">Henüz yüklenmiş belge yok.</div>
      )}
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex items-center justify-center gap-2 mb-4 no-print">
        <img src="/logo-header.png" alt="MED CARE ANIMALS" className="h-8 w-8" />
        <span className="font-display font-bold text-sm">MED CARE ANIMALS</span>
      </div>

      <div className="card p-4 mb-5">
        <h1 className="text-lg font-bold">{patient.name}</h1>
        <div className="text-xs text-text3">{patient.breed} · Sahibi: {patient.owner_name}</div>
      </div>

      <div>
        <div className="text-xs font-bold text-text3 uppercase mb-2">e-Klinik</div>
        {labPanel}
      </div>

      <WhatsAppContact
        hospitalNumber={process.env.WHATSAPP_HOSPITAL_NUMBER || ''}
        patientName={patient.name}
      />
    </div>
  );
}
