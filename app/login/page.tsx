import Link from 'next/link';

export default function LoginGate() {
  return (
    <div className="min-h-screen flex flex-col items-center pt-16 px-4">
      <div className="flex flex-col items-center text-center mb-9">
        <div className="w-16 h-16 rounded-2xl bg-navy flex items-center justify-center text-white font-display font-bold text-xl mb-4">
          V
        </div>
        <h1 className="text-2xl font-bold">Vetora Live</h1>
        <p className="text-text2 text-sm mt-1.5 max-w-sm">
          Yatılı hasta takip ve hasta sahibi iletişim portalı.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl">
        <Link href="/login/staff" className="card p-5 text-left hover:border-accent transition-colors">
          <div className="font-bold text-sm">Personel Girişi</div>
          <div className="text-xs text-text3 mt-1">Veteriner, teknisyen, resepsiyon</div>
          <div className="text-accent text-xs font-bold mt-3">Devam et →</div>
        </Link>
        <Link href="/login/admin" className="card p-5 text-left hover:border-accent transition-colors">
          <div className="font-bold text-sm">Yönetici Girişi</div>
          <div className="text-xs text-text3 mt-1">Klinik yönetimi ve raporlar</div>
          <div className="text-accent text-xs font-bold mt-3">Devam et →</div>
        </Link>
      </div>

      <div className="max-w-xl w-full mt-6 text-xs text-text2 bg-surface2 border border-border rounded-xl p-4">
        Hasta sahibiyseniz bu sayfadan giriş yapamazsınız — hastanenizden aldığınız{' '}
        <strong>özel bağlantı veya QR kod</strong> ile doğrudan hastanızın sayfasına ulaşırsınız.
      </div>
    </div>
  );
}
