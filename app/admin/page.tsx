import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/TopBar';

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: { error?: string; staffAdded?: string };
}) {
  const supabase = createClient();
  const { data: patients } = await supabase.from('patients').select('id, name, status').is('discharged_at', null);
  const { data: staff } = await supabase.from('profiles').select('id, full_name, role');

  const critical = (patients ?? []).filter((p) => p.status === 'critical');

  return (
    <div>
      <TopBar />
      <div className="max-w-3xl mx-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold">Yönetici Paneli</h1>
          <Link href="/patients/new" className="btn-primary !py-1.5 !px-3 !text-xs">
            + Yeni Hasta Ekle
          </Link>
        </div>

        {searchParams?.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red font-semibold">
            {searchParams.error}
          </div>
        )}
        {searchParams?.staffAdded && (
          <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green font-semibold">
            ✓ Personel eklendi. E-posta ve şifreyi kendilerine iletebilirsin.
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="card p-4">
            <div className="text-xs font-semibold text-text2">Yatılı Hasta</div>
            <div className="text-2xl font-bold mt-1">{patients?.length ?? 0}</div>
          </div>
          <div className="card p-4 bg-red-50">
            <div className="text-xs font-semibold text-red">Kritik</div>
            <div className="text-2xl font-bold mt-1 text-red">{critical.length}</div>
          </div>
        </div>

        <div className="text-xs font-bold text-text3 uppercase mb-2">Kritik Hastalar</div>
        <div className="card divide-y divide-border mb-6">
          {critical.map((p) => (
            <Link key={p.id} href={`/patients/${p.id}`} className="block p-3.5 hover:bg-surface2 text-sm font-bold">
              {p.name}
            </Link>
          ))}
          {critical.length === 0 && <div className="p-4 text-sm text-text3">Kritik hasta yok.</div>}
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold text-text3 uppercase">Personel</div>
          <Link href="/admin/staff/new" className="text-xs font-bold text-accent">
            + Yeni Personel Ekle
          </Link>
        </div>
        <div className="card divide-y divide-border">
          {(staff ?? []).map((s) => (
            <div key={s.id} className="p-3.5 text-sm">
              <span className="font-bold">{s.full_name}</span>{' '}
              <span className="text-text3">· {s.role}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
