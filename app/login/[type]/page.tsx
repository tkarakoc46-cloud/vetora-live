import { login } from '../actions';
import Link from 'next/link';
import { notFound } from 'next/navigation';

const META: Record<string, { title: string; sub: string }> = {
  staff: { title: 'Personel Girişi', sub: 'Veteriner, teknisyen ve resepsiyon ekibi için.' },
  admin: { title: 'Yönetici Girişi', sub: 'Klinik yönetimi ve raporlar için.' },
};

export default function LoginForm({
  params,
  searchParams,
}: {
  params: { type: string };
  searchParams: { error?: string };
}) {
  const meta = META[params.type];
  if (!meta) notFound();

  return (
    <div className="min-h-screen flex flex-col items-center pt-16 px-4">
      <div className="card p-6 w-full max-w-sm">
        <Link href="/login" className="text-xs font-bold text-accent">
          ← Geri
        </Link>
        <h2 className="text-lg font-bold mt-3">{meta.title}</h2>
        <p className="text-xs text-text2 mb-4">{meta.sub}</p>

        {searchParams.error && (
          <div className="bg-red-50 text-red text-xs font-medium rounded-lg px-3 py-2.5 mb-3">
            {searchParams.error}
          </div>
        )}

        <form action={login} className="field space-y-3">
          <input type="hidden" name="type" value={params.type} />
          <div>
            <label>E-posta</label>
            <input type="email" name="email" placeholder="ornek@klinik.com" required autoFocus />
          </div>
          <div>
            <label>Şifre</label>
            <input type="password" name="password" placeholder="••••••••" required />
          </div>
          <button type="submit" className="btn-primary w-full !mt-4">
            Giriş Yap
          </button>
        </form>
      </div>
    </div>
  );
}
