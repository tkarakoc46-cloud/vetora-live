import { createClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/TopBar';
import Link from 'next/link';

const STATUS_LABEL: Record<string, string> = {
  stable: 'Stabil',
  improving: 'İyiye Gidiyor',
  watch: 'Yakın Takip',
  critical: 'Kritik',
};
const STATUS_COLOR: Record<string, string> = {
  stable: 'bg-green-50 text-green',
  improving: 'bg-accentSoft text-accent',
  watch: 'bg-amber-50 text-amber',
  critical: 'bg-red-50 text-red',
};

function formatIstanbul(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Read-only "hepsini gör, düzenlemem gerekmesin" panel: every patient the
// clinic has ever admitted, active ones first, with a link into the full
// editable detail page only if you actually want to open one. Nothing on
// this page itself can be changed.
export default async function AllPatients() {
  const supabase = createClient();

  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, species, breed, status, kennel_no, owner_name, admitted_at, discharged_at')
    .order('admitted_at', { ascending: false });

  const active = (patients ?? []).filter((p) => !p.discharged_at);
  const discharged = (patients ?? []).filter((p) => p.discharged_at);

  return (
    <div>
      <TopBar />
      <div className="max-w-3xl mx-auto p-5">
        <h1 className="text-lg font-bold mb-4">Tüm Hastalar</h1>

        <div className="text-xs font-bold text-text3 uppercase mb-2">Yatılı ({active.length})</div>
        <div className="card divide-y divide-border mb-6">
          {active.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 p-3.5 hover:bg-surface2">
              <div className="flex-1">
                <div className="font-bold text-sm">
                  {p.name} <span className="font-medium text-text3">· {p.breed || p.species}</span>
                </div>
                <div className="text-xs text-text3 mt-0.5">
                  {p.kennel_no ? p.kennel_no + ' · ' : ''}Sahibi: {p.owner_name} · Giriş: {formatIstanbul(p.admitted_at)}
                </div>
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLOR[p.status]}`}>
                {STATUS_LABEL[p.status]}
              </span>
            </Link>
          ))}
          {active.length === 0 && <div className="p-6 text-center text-sm text-text3">Yatılı hasta yok.</div>}
        </div>

        <div className="text-xs font-bold text-text3 uppercase mb-2">Taburcu Edilmiş ({discharged.length})</div>
        <div className="card divide-y divide-border">
          {discharged.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 p-3.5 hover:bg-surface2 opacity-70">
              <div className="flex-1">
                <div className="font-bold text-sm">
                  {p.name} <span className="font-medium text-text3">· {p.breed || p.species}</span>
                </div>
                <div className="text-xs text-text3 mt-0.5">
                  Sahibi: {p.owner_name} · Taburcu: {formatIstanbul(p.discharged_at!)}
                </div>
              </div>
            </Link>
          ))}
          {discharged.length === 0 && <div className="p-6 text-center text-sm text-text3">Taburcu edilmiş hasta yok.</div>}
        </div>
      </div>
    </div>
  );
}
