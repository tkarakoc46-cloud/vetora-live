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
  tomografi: '☢️',
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

// e-Klinik belge satırındaki aksiyon simgeleri — sadece ikon (metin yok),
// dar telefon ekranlarında satırın taşmasını/kaymasını önlemek için.
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 32 32" width="18" height="18" fill="#25D366" aria-hidden="true">
      <path d="M16.004 3C9.096 3 3.5 8.596 3.5 15.504c0 2.373.657 4.59 1.797 6.484L3 29l7.178-2.256a12.42 12.42 0 0 0 5.826 1.457h.005c6.906 0 12.502-5.596 12.502-12.504C28.511 8.789 22.911 3 16.004 3Zm0 22.79h-.004a10.33 10.33 0 0 1-5.264-1.443l-.378-.225-3.912 1.229 1.246-3.812-.246-.391a10.24 10.24 0 0 1-1.576-5.44c0-5.712 4.65-10.362 10.365-10.362 2.768 0 5.369 1.08 7.326 3.038a10.28 10.28 0 0 1 3.036 7.328c0 5.713-4.65 10.078-10.593 10.078Zm5.68-7.55c-.311-.156-1.84-.908-2.126-1.012-.286-.104-.494-.156-.702.156-.208.312-.806 1.012-.988 1.22-.182.208-.364.234-.675.078-.312-.156-1.316-.485-2.507-1.547-.927-.826-1.553-1.846-1.735-2.158-.182-.312-.02-.481.137-.636.14-.14.312-.364.468-.546.156-.182.208-.312.312-.52.104-.208.052-.39-.026-.546-.078-.156-.702-1.692-.962-2.318-.253-.61-.51-.527-.702-.537l-.598-.011c-.208 0-.546.078-.832.39-.286.312-1.09 1.065-1.09 2.6 0 1.534 1.116 3.018 1.272 3.226.156.208 2.196 3.354 5.32 4.702.743.32 1.323.512 1.775.656.746.237 1.424.204 1.96.124.598-.09 1.84-.752 2.1-1.478.26-.727.26-1.35.182-1.478-.078-.13-.286-.208-.598-.364Z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

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
            const isDocxFile = fileNameLower.endsWith('.docx');
            const isPdfFile = fileNameLower.endsWith('.pdf');
            const isImageFile = !isPdfFile && !isDocxFile;
            // "Şablona Uygula" sadece "Tomografi" kategorisiyle yüklenmiş bir
            // Word (.docx) veya PDF belgesinde çıkar — kan tahlili/röntgen
            // gibi başka kategorideki belgeleri BT raporu gibi ayırmaya
            // çalışıp anlamsız sonuç üretmesin diye kategoriye de bakıyoruz.
            const isTomografiTemplateEligible = l.category === 'tomografi' && (isDocxFile || isPdfFile);
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
                </div>
                {/* İkinci satır: aksiyon ikonları — ayrı satırda olduğu için
                    dar telefon ekranlarında üst satırı (başlık/tarih) yana
                    itip panelin kaymasına/taşmasına sebep olmuyor; gerekirse
                    kendi içinde sarabiliyor (flex-wrap). Her biri sadece
                    ikon: metin yerine title/aria-label ile açıklanıyor. */}
                <div className="flex items-center justify-end gap-1 flex-wrap mt-1">
                  {waHref && (
                    <a
                      href={waHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Hasta sahibine WhatsApp'tan haber ver"
                      aria-label="Hasta sahibine WhatsApp'tan haber ver"
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface2"
                    >
                      <WhatsAppIcon />
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
                  {isTomografiTemplateEligible && (
                    <TomografiTemplateButton
                      patientId={params.id}
                      labResultId={l.id}
                      defaultTitle={l.title}
                      defaultTakenAt={l.taken_at}
                    />
                  )}
                  <form action={deleteLabResult.bind(null, params.id, l.id, l.storage_path)}>
                    <button
                      type="submit"
                      title="Belgeyi sil"
                      aria-label="Belgeyi sil"
                      className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface2 text-red"
                    >
                      <TrashIcon />
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
          📐 Şablona Uygula: "Tomografi" olarak yüklenen düz yazı bir Word (.docx) veya PDF raporunu okuyup Trakya
          Hayvan Hastanesi logolu rapor şablonuna döker; siz kontrol edip onayladıktan sonra PDF olarak arşive
          eklenir. Orijinal dosya silinmez, ayrıca arşivde kalır.
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
