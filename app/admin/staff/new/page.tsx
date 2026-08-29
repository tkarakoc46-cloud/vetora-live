import { addStaff } from '@/lib/actions/staff';
import { TopBar } from '@/components/TopBar';
import { SubmitButton } from '@/components/SubmitButton';
import Link from 'next/link';

export default function NewStaff({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <TopBar />
      <div className="max-w-lg mx-auto p-5">
        <Link href="/admin" className="text-xs font-bold text-accent">
          ← Geri
        </Link>
        <h1 className="text-lg font-bold mt-3 mb-4">Yeni Personel Ekle</h1>

        {searchParams?.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red font-semibold">
            {searchParams.error}
          </div>
        )}

        <form action={addStaff} className="field card p-4 space-y-3">
          <div>
            <label>Ad Soyad</label>
            <input name="full_name" required placeholder="Örn: Ayşe Yılmaz" />
          </div>
          <div>
            <label>Rol</label>
            <select name="role" required defaultValue="">
              <option value="" disabled>
                Seçiniz
              </option>
              <option value="VETERINER">Veteriner</option>
              <option value="TEKNISYEN">Teknisyen</option>
              <option value="RESEPSIYON">Resepsiyon</option>
              <option value="ADMIN">Yönetici</option>
            </select>
          </div>
          <div>
            <label>E-posta (giriş için kullanacak)</label>
            <input name="email" type="email" required placeholder="ornek@klinik.com" />
          </div>
          <div>
            <label>Şifre</label>
            <input name="password" type="text" required minLength={6} placeholder="En az 6 karakter" />
          </div>
          <div className="text-[11px] text-text3">
            Bu e-posta ve şifreyi personele sen ileteceksin — girişte bunları kullanacaklar. Personel Girişi ekranından değil, girdiğin role göre Personel veya Yönetici girişinden bağlanacaklar.
          </div>

          <SubmitButton className="btn-primary w-full !mt-2" pendingText="Ekleniyor…">
            Personeli Ekle
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
