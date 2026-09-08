import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/TopBar';

function formatIstanbul(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export default async function Dashboard() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user!.id).single();

  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, species, breed, owner_name, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  const { count: totalCount } = await supabase.from('patients').select('id', { count: 'exact', head: true });

  return (
    <div>
      <TopBar />
    <div className="max-w-3xl mx-auto p-5">
      <div className="text-xs font-bold text-text3 uppercase mb-1">Bugün</div>
      <h1 className="text-xl font-bold mb-5">Merhaba, {profile?.full_name?.split(' ')[0] ?? ''} 👋</h1>

      <div className="card p-4 mb-6">
        <div className="text-xs font-semibold text-text2">Toplam Hasta</div>
        <div className="text-2xl font-bold mt-1">{totalCount ?? 0}</div>
      </div>

      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-text3 uppercase">Son Eklenen Hastalar</div>
        <Link href="/patients/new" className="btn-primary !py-1.5 !px-3 !text-xs">
          + Yeni Hasta Ekle
        </Link>
      </div>
      <div className="card divide-y divide-border">
        {(patients ?? []).map((p) => (
          <Link key={p.id} href={`/patients/${p.id}`} className="flex items-center gap-3 p-3.5 hover:bg-surface2">
            <div className="flex-1">
              <div className="font-bold text-sm">
                {p.name} <span className="font-medium text-text3">· {p.breed || p.species}</span>
              </div>
              <div className="text-xs text-text3 mt-0.5">Sahibi: {p.owner_name} · {formatIstanbul(p.created_at)}</div>
            </div>
          </Link>
        ))}
        {(patients ?? []).length === 0 && (
          <div className="p-6 text-center text-sm text-text3">Henüz hasta kaydı yok.</div>
        )}
      </div>
      <div className="text-center mt-3">
        <Link href="/patients" className="text-xs font-bold text-accent">
          Tüm hastaları gör →
        </Link>
      </div>
    </div>
    </div>
  );
}
