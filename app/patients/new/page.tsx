import { addPatient } from '@/lib/actions/patients';
import { TopBar } from '@/components/TopBar';
import { SubmitButton } from '@/components/SubmitButton';
import Link from 'next/link';

export default function NewPatient({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div>
      <TopBar />
      <div className="max-w-lg mx-auto p-5">
        <Link href="/dashboard" className="text-xs font-bold text-accent">
          ← Geri
        </Link>
        <h1 className="text-lg font-bold mt-3 mb-4">Yeni Hasta Ekle</h1>

        {searchParams?.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red font-semibold">
            {searchParams.error}
          </div>
        )}

        <form action={addPatient} className="field card p-4 space-y-3">
          <div>
            <label>Hasta adı</label>
            <input name="name" required placeholder="Örn: Luna" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Tür</label>
              <input name="species" required placeholder="Köpek / Kedi" />
            </div>
            <div>
              <label>Irk</label>
              <input name="breed" placeholder="Golden Retriever" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Cinsiyet</label>
              <select name="sex">
                <option value="">Seçiniz</option>
                <option value="Erkek">Erkek</option>
                <option value="Dişi">Dişi</option>
              </select>
            </div>
            <div>
              <label>Yaş</label>
              <input name="age_years" type="number" step="0.5" placeholder="4" />
            </div>
          </div>
          <div>
            <label>Kafes / Oda no</label>
            <input name="kennel_no" placeholder="A-3" />
          </div>

          <div className="pt-2 border-t border-border" />

          <div>
            <label>Hasta sahibinin adı</label>
            <input name="owner_name" required placeholder="Ad Soyad" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label>Telefon</label>
              <input name="owner_phone" placeholder="05xx xxx xx xx" />
            </div>
            <div>
              <label>E-posta</label>
              <input name="owner_email" type="email" placeholder="opsiyonel" />
            </div>
          </div>

          <SubmitButton className="btn-primary w-full !mt-5" pendingText="Kaydediliyor…">
            Hastayı Kaydet
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}
