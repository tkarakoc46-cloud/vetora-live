import QRCode from 'qrcode';
import { createClient } from '@/lib/supabase/server';
import { addNoteRecord } from '@/lib/actions/records';
import { deletePatient } from '@/lib/actions/patients';
import { deleteLabResult } from '@/lib/actions/labResults';
import { notFound } from 'next/navigation';
import { TopBar } from '@/components/TopBar';
import { PrintButton } from '@/components/PrintButton';
import { DeletePatientForm } from '@/components/DeletePatientForm';
import { SubmitButton } from '@/components/SubmitButton';
import { CopyButton } from '@/components/CopyButton';
import { LabResultUploadForm } from '@/components/LabResultUploadForm';
import { LabResultDigitizeButton } from '@/components/OcrReviewPanel';
import { TomografiTemplateButton } from '@/components/TomografiReviewPanel';
import { toWhatsAppNumber } from '@/lib/phone';

// e-Klinik "Dijitalleştir" (OCR) adımı bu sayfadan tetiklenen bir Server
// Action olarak çalışıyor; Gemini'ye görüntü gönderip yapılandırılmış bir
// yanıt alması varsayılan sunucusuz fonksiyon süresinden (10sn) biraz daha
// uzun sürebiliyor, bu yüzden bu route için süreyi artırıyoruz (Vercel
// planınız izin verdiği kadarıyla).
export const maxDuration = 60;

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
// "Hasta Sahibine Gönder" düğmesinin WhatsApp mesaj metninde kullanılan,
// CATEGORY_LABEL'dan farklı olarak cümle içinde doğal duran küçük harfli
// biçim (ör. "kan tahlili sonucu çıkmıştır").
const CATEGORY_PHRASE: Record<string, string> = {
  kan_tahlili: 'kan tahlili',
  tomografi: 'tomografi',
  rontgen: 'röntgen',
  diger: 'belge',
};

function formatIstanbul(iso: string) {
  return new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateOnly(dateStr: string) {
  // taken_at bir `date` kolonu (saatsiz) — saat dilimi çevirisine gerek yok,
  // olduğu gibi gg.aa.yyyy formatına çeviriyoruz.
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

export default async function PatientDetail({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { error?: string };
}) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: myProfile } = await supabase.from('profiles').select('role').eq('id', user!.id).single();
  const isAdmin = myProfile?.role === 'ADMIN';

  const { data: patient } = await supabase.from('patients').select('*').eq('id', params.id).single();
  if (!patient) notFound();

  // Zaman çizelgesi artık sadece "Not" kaydı üretiyor, ama eski (yatılı
  // hasta takibi döneminden kalma) vital/ameliyat/olay/fotoğraf kayıtları
  // varsa okunabilir kalması için burada hâlâ hepsini çekiyoruz.
  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false })
    .limit(500);

  const { data: labResultRows } = await supabase
    .from('lab_results')
    .select('*')
    .eq('patient_id', params.id)
    .order('created_at', { ascending: false });

  // Personel de sahibi gibi imzalı (geçici) bir link üzerinden görüntülüyor —
  // bucket private olduğu için doğrudan public URL yok.
  const labResults = await Promise.all(
    (labResultRows ?? []).map(async (l) => {
      const { data } = await supabase.storage.from('lab-results').createSignedUrl(l.storage_path, 3600);
      return { ...l, signedUrl: data?.signedUrl };
    })
  );

  // bind the patient id so the <form action={...}> below doesn't need a hidden input
  const addNote = addNoteRecord.bind(null, params.id);
  const removePatient = deletePatient.bind(null, params.id);

  const ownerLink = `${process.env.NEXT_PUBLIC_APP_URL}/p/${patient.access_token}`;
  // Meta'nın WhatsApp Cloud API'si (tam otomatik gönderim) iş hesabı
  // doğrulaması ve onaylı mesaj şablonu gerektiriyor — bunun yerine hiçbir
  // kurulum istemeyen basit yolu kullanıyoruz: bir wa.me linki, mesaj ve
  // hasta sahibinin numarası önceden dolu şekilde WhatsApp'ı açar, personel
  // sadece "Gönder"e dokunur (bkz. her belge satırındaki düğme, aşağıda).
  const ownerWaNumber = toWhatsAppNumber(patient.owner_phone);
  // Generated server-side as a data: URI — no external QR service call, so
  // this works even if the clinic's photocopied handout has no internet
  // access; it's just an image once it's on the page or printed.
  const qrDataUrl = await QRCode.toDataURL(ownerLink, {
    width: 260,
    margin: 1,
    color: { dark: '#131C3B', light: '#FFFFFF' },
  });

  return (
    <div>
      <TopBar />
    <div className="max-w-3xl mx-auto p-5">
      {searchParams?.error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red font-semibold no-print">
          {searchParams.error}
        </div>
      )}

      <div className="card p-4 mb-5">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold">{patient.name}</h1>
          <span className="text-xs font-bold px-2 py-1 rounded-full bg-surface2 text-text3">e-Klinik</span>
        </div>
        <div className="text-xs text-text3">
          {patient.breed} · Sahibi: {patient.owner_name}
        </div>
        <div className="mt-3 no-print">
          <PrintButton />
        </div>
      </div>

      <div className="card p-4 mb-5 no-print">
        <div className="font-bold text-sm mb-2">Hasta Sahibi Bağlantısı</div>
        <div className="flex flex-col sm:flex-row gap-4">
          <img
            src={qrDataUrl}
            alt="Hasta sahibi bağlantısı QR kodu"
            className="w-40 h-40 rounded-lg border border-border self-start"
          />
          <div className="flex-1 min-w-0">
            <div className="text-xs text-text2 mono break-all bg-surface2 rounded-lg px-3 py-2 mb-2">
              {ownerLink}
            </div>
            <CopyButton text={ownerLink} />
            <div className="text-[11px] text-text3 mt-2">
              Bu linki veya QR kodu hasta sahibine gönderin ya da yazdırıp verin — hastanızın e-Klinik belgelerine
              doğrudan götürür, giriş yapmalarına gerek yok.
            </div>
          </div>
        </div>
      </div>

      <div className="card p-4 mb-5 no-print">
        <div className="font-bold text-sm mb-2">e-Klinik</div>
        <LabResultUploadForm patientId={params.id} />
        <div className="text-[11px] text-text3 mb-2">
          Yüklenen belge (PDF, resim veya Word) olduğu gibi kalıcı olarak arşivlenir, silinmediği sürece kaybolmaz; hasta sahibinin
          takip linkindeki e-Klinik sekmesinde de görünür. Bir belgeye dokunduğunuzda yeni sekmede açılır — oradan
          tarayıcının/PDF görüntüleyicinin kendi paylaş veya yazdır simgesiyle yazdırabilir ya da telefonunuza kaydedebilirsiniz.
        </div>
        <div className="divide-y divide-border rounded-lg border border-border">
          {labResults.map((l) => {
            const fileNameLower = (l.file_name || '').toLowerCase();
            const isImageFile = !fileNameLower.endsWith('.pdf') && !fileNameLower.endsWith('.docx');
            const isDocxFile = fileNameLower.endsWith('.docx');
            const waText = `${patient.name} isimli hastanızın ${CATEGORY_PHRASE[l.category] ?? 'belge'} sonucu çıkmıştır. MED CARE ANIMALS linki üzerinden görüntüleyebilirsiniz: ${ownerLink}`;
            const waHref = ownerWaNumber ? `https://wa.me/${ownerWaNumber}?text=${encodeURIComponent(waText)}` : null;
            return (
              <div key={l.id} className="p-3 text-sm">
                <div className="flex items-center gap-3">
                  <span>{CATEGORY_ICON[l.category] ?? '📄'}</span>
                  <a
                    href={l.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 font-semibold text-accent truncate"
                  >
                    {l.title}
                    <span className="block text-[11px] text-text3 font-normal">
                      {CATEGORY_LABEL[l.category] ?? 'Diğer'} · Görüntüle / Yazdır
                    </span>
                  </a>
                  <span className="text-xs text-text3 whitespace-nowrap">
                    {l.taken_at ? formatDateOnly(l.taken_at) : formatIstanbul(l.created_at)}
                  </span>
                  {waHref && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-green font-semibold ml-1 whitespace-nowrap"
                      title="Hasta sahibine WhatsApp'tan haber ver"
                    >
                      📱 Gönder
                    </a>
                  )}
                  {isImageFile && (
                    <LabResultDigitizeButton
                      patientId={params.id}
                      labResultId={l.id}
                      defaultTitle={l.title}
                      defaultCategory={l.category}
                      defaultTakenAt={l.taken_at}
                    />
                  )}
                  {isDocxFile && (
                    <TomografiTemplateButton
                      patientId={params.id}
                      labResultId={l.id}
                      defaultTitle={l.title}
                      defaultTakenAt={l.taken_at}
                    />
                  )}
                  <form action={deleteLabResult.bind(null, params.id, l.id, l.storage_path)}>
                    <button type="submit" className="text-xs text-red font-semibold ml-1">
                      Sil
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
          {labResults.length > 0 && !ownerWaNumber && (
            <div className="px-3 py-2 text-[11px] text-text3 bg-surface2">
              Hasta sahibine WhatsApp'tan haber vermek için önce hasta kaydına geçerli bir telefon numarası ekleyin.
            </div>
          )}
          {labResults.length === 0 && (
            <div className="p-4 text-center text-xs text-text3">Henüz yüklenmiş belge yok.</div>
          )}
        </div>
        <div className="text-[11px] text-text3 mt-2">
          🔎 Dijitalleştir: fotoğraf/tarama olarak yüklenen bir belgedeki yazıyı otomatik okuyup düzenli bir tabloya
          çevirir; siz kontrol edip onayladıktan sonra MED CARE ANIMALS logolu, yazdırılabilir bir PDF olarak arşive
          eklenir. Orijinal fotoğraf silinmez, ayrıca arşivde kalır.
        </div>
        <div className="text-[11px] text-text3 mt-1">
          📐 Şablona Uygula: yüklenen düz yazı Word (.docx) tomografi raporunu okuyup Trakya Hayvan Hastanesi logolu
          rapor şablonuna döker; siz kontrol edip onayladıktan sonra PDF olarak arşive eklenir. Orijinal Word dosyası
          silinmez, ayrıca arşivde kalır.
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-6 no-print">
        <form action={addNote} className="field card p-4 space-y-2">
          <div className="font-bold text-sm mb-1">Not Ekle</div>
          <textarea name="text" rows={3} placeholder="Not…" required />
          <label className="flex items-center gap-2 text-xs text-text2">
            <input type="checkbox" name="visible_to_owner" /> Hasta sahibine göster
          </label>
          <SubmitButton>Kaydet</SubmitButton>
        </form>
      </div>

      {(records ?? []).length > 0 && (
        <>
          <div className="text-xs font-bold text-text3 uppercase mb-2">Zaman Çizelgesi</div>
          <div className="card divide-y divide-border mb-6">
            {(records ?? []).map((r) => (
              <div key={r.id} className="p-3.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">{r.type === 'note' ? 'Not' : r.type}</span>
                  <span className="text-xs text-text3 mono">{formatIstanbul(r.created_at)}</span>
                </div>
                <div className="text-xs text-text2 mt-1">
                  {r.type === 'note' ? r.payload?.text : JSON.stringify(r.payload)}
                </div>
                <div className="text-xs text-text3 mt-1">
                  {r.created_by_name}
                  {r.visible_to_owner === false ? ' · sadece personel' : ''}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {isAdmin && (
        <div className="card p-4 mb-6 border-red-200 no-print">
          <div className="font-bold text-sm mb-1 text-red">Tehlikeli Bölge</div>
          <div className="text-xs text-text3 mb-3">
            Bu hastayı ve tüm kayıtlarını (zaman çizelgesi, belgeler, mesajlar) kalıcı olarak siler. Geri alınamaz.
          </div>
          <DeletePatientForm action={removePatient} patientName={patient.name} />
        </div>
      )}
    </div>
    </div>
  );
}
