import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/TopBar';

const STATUS_LABEL: Record<string, string> = { stable: 'Stabil', watch: 'Yakın Takip', critical: 'Kritik' };
const STATUS_COLOR: Record<string, string> = {
  stable: 'bg-green-50 text-green',
  watch: 'bg-amber-50 text-amber',
  critical: 'bg-red-50 text-red',
};

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, species, breed, status, kennel_no')
    .is('discharged_at', null)
    .order('status', { ascending: true });

  const critical = (patients ?? []).filter((p) => p.status === 'critical').length;

  return (
    <div>
      <TopBar />
    <div className="max-w-3xl mx-auto p-5">
      <div className="text-xs font-bold text-text3 uppercase mb-1">Bugün</div>
      <h1 className="text-xl font-bold mb-5">Merhaba, {profile?.full_name?.split(' ')[0] ?? ''} 👋</h1>

      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card p-4">
          <div className="text-xs font-semibold text-text2">Yatılı Hasta</div>
          <div className="text-2xl font-bold mt-1">{patients?.length ?? 0}</div>
        </div>
        <div className="card p-4 bg-red-50">
          <div className="text-xs font-semibold text-red">Kritik</div>
          <div className="text-2xl font-bold mt-1 text-red">{critical}</div>
        </div>
      </div>

      <div className="text-xs font-bold text-text3 uppercase mb-2">Yatılı Hastalar</div>
      <div className="card divide-y divide-border">
        {(patients ?? []).map((p) => (
          <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 p-3.5 hover:bg-surface2">
            <div className="flex-1">
              <div className="font-bold text-sm">
                {p.name} <span className="font-medium text-text3">· {p.breed}</span>
              </div>
              <div className="text-xs text-text3 mt-0.5">{p.kennel_no}</div>
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLOR[p.status]}`}>
              {STATUS_LABEL[p.status]}
            </span>
          </Link>
        ))}
        {(patients ?? []).length === 0 && (
          <div className="p-6 text-center text-sm text-text3">Şu anda yatılı hasta yok.</div>
        )}
      </div>
    </div>
    </div>
  );
}
