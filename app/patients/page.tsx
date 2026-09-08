import { createClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/TopBar';
import Link from 'next/link';

function formatIstanbul(iso: string) {
  return new Date(iso).toLocaleDateString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Read-only "hepsini gör, düzenlemem gerekmesin" panel: kliniğin şimdiye
// kadar kaydettiği her hasta, en yeni en üstte. Tıklanınca düzenlenebilir
// tam detay sayfasına gider; bu sayfanın kendisinde hiçbir şey
// değiştirilemez.
export default async function AllPatients() {
  const supabase = createClient();

  const { data: patients } = await supabase
    .from('patients')
    .select('id, name, species, breed, owner_name, created_at')
    .order('created_at', { ascending: false });

  return (
    <div>
      <TopBar />
      <div className="max-w-3xl mx-auto p-5">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold">Tüm Hastalar ({(patients ?? []).length})</h1>
          <Link href="/patients/new" className="text-xs font-bold text-accent">
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
                <div className="text-xs text-text3 mt-0.5">
                  Sahibi: {p.owner_name} · Kayıt: {formatIstanbul(p.created_at)}
                </div>
              </div>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-surface2 text-text3">e-Klinik</span>
            </Link>
          ))}
          {(patients ?? []).length === 0 && (
            <div className="p-6 text-center text-sm text-text3">Henüz hasta kaydı yok.</div>
          )}
        </div>
      </div>
    </div>
  );
}
