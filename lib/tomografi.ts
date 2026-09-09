// e-Klinik "Tomografi Raporu" özelliği: personelin yüklediği düz metin
// tomografi raporunu (Word .docx VEYA PDF olarak), Trakya Hayvan
// Hastanesi'nin kendi tasarım şablonuna göre biçimlendirilmiş bir PDF'e
// çevirir.
//
// İki giriş yolu var:
//   1) .docx dosyaları: extractDocxText() ile (mammoth kütüphanesi)
//      önce düz metne çevrilir, sonra segmentTomografiReport() bu metni
//      Gemini'ye gönderip 3 parçaya ayırır.
//   2) .pdf dosyaları: segmentTomografiFromPdf() PDF'i doğrudan (metin
//      çıkarma adımı olmadan) Gemini'ye gönderir — Gemini hem düz metin
//      içeren (Word'den "PDF olarak kaydet" ile üretilmiş) hem de
//      TARANMIŞ/FOTOĞRAFLANMIŞ (görüntü tabanlı) PDF'leri okuyabiliyor,
//      bu yüzden ayrı bir metin-çıkarma kütüphanesine gerek yok.
// Her iki yol da aynı 3 parçaya ayrılmış sonucu (TomografiDraft) üretir.
//
// ÖNEMLİ: extractLabRowsWithGemini (lib/ocr.ts) ile aynı Gemini
// çağrısı/yeniden deneme deseni burada KASITLI OLARAK ayrıca yazıldı
// (kopyalandı) — çalışan OCR özelliğini hiç etkilememek için ortak bir
// yardımcıya taşımadık.

import mammoth from 'mammoth';

export type TomografiDraft = {
  examTitle: string;
  findings: string[];
  sonucLines: string[];
  // Belgenin içinde geçen rapor tarihi — "YYYY-MM-DD" biçiminde, ISO 8601.
  // Belgede tanınabilir bir tarih yoksa boş string olur (bu durumda
  // arayüzde yükleme tarihine geri dönülür, bkz. TomografiReviewPanel).
  reportDate: string;
};

const GEMINI_MODEL = 'gemini-flash-latest';
const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = [1500, 3000];
const RETRYABLE_STATUS = new Set([503, 429, 500, 502, 504]);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function extractDocxText(bytes: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer: bytes });
  return (result.value || '').trim();
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    examTitle: { type: 'STRING' },
    findings: { type: 'ARRAY', items: { type: 'STRING' } },
    sonucLines: { type: 'ARRAY', items: { type: 'STRING' } },
    reportDate: { type: 'STRING' },
  },
  required: ['examTitle', 'findings', 'sonucLines', 'reportDate'],
};

const INSTRUCTIONS = `Bu, bir veteriner hastanesine ait TOMOGRAFİ (BT) raporu. Rapordaki tıbbi metni şu 3 parçaya ayır:

1) examTitle: incelemenin kısa başlığı/türü (ör. "KRANİAL BT", "TORAKS BT", "ABDOMEN BT"). Genelde raporun en başında kısa, büyük harfli bir satır olarak bulunur. Yoksa, içeriğe bakarak en uygun kısa başlığı sen oluştur.
2) findings: bulgular/inceleme paragrafları — orijinal cümleleri DEĞİŞTİRMEDEN, mantıklı paragraflara ayırarak bir dizi metin parçası olarak ver.
3) sonucLines: "Sonuç" veya "Değerlendirme" başlığından sonra gelen nihai değerlendirme cümle(leri) — her biri ayrı bir dizi elemanı olarak.
4) reportDate: belgenin içinde geçen RAPOR/İNCELEME TARİHİ (ör. belge başlığında, üst bilgide, "Tarih:", "İnceleme Tarihi:" gibi bir etiketin yanında veya raporun herhangi bir yerinde geçen tarih). Bulursan "YYYY-MM-DD" biçiminde (ISO 8601, 4 haneli yıl-2 haneli ay-2 haneli gün) normalize ederek ver — örneğin "09.09.2026" veya "9 Eylül 2026" gördüysen "2026-09-09" olarak döndür. Belgede hiç tarih bulamazsan boş string ("") döndür, ASLA tarih uydurma.

Rapor sonunda genelde bulunan sabit yasal uyarı/feragat cümlelerini (ör. "değerlendirme mevcut teknik olanaklar ve tıbbi bilgiler doğrultusunda yapılmıştır", "...klinik, muayene, laboratuvar ve varsa patoloji bulguları ile değerlendirilmesi önerilir" gibi) sonucLines veya findings içine DAHİL ETME — bunlar zaten şablonda sabit olarak var. Hasta/hasta sahibi adı, hastane adı gibi bilgileri de dahil etme, sadece tıbbi metni işle (tarih hariç — tarihi ayrıca reportDate alanına koy). Orijinal metindeki cümleleri olduğu gibi koru, uydurma veya özetleme yapma; okunabilir bir rapor metni bulamazsan examTitle'ı boş, findings ve sonucLines'ı boş dizi, reportDate'i boş string döndür.`;

async function callGemini(apiKey: string, parts: any[]): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              response_mime_type: 'application/json',
              response_schema: RESPONSE_SCHEMA,
              temperature: 0,
            },
          }),
        }
      );

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        // eslint-disable-next-line no-console
        console.error(`Gemini API hata döndürdü (deneme ${attempt}/${MAX_ATTEMPTS}):`, res.status, errBody);
        if (res.status === 400 && /API key not valid/i.test(errBody)) {
          throw new Error('GEMINI_API_KEY_INVALID');
        }
        if (RETRYABLE_STATUS.has(res.status) && attempt < MAX_ATTEMPTS) {
          lastError = new Error(res.status === 429 ? 'GEMINI_QUOTA_EXCEEDED' : `GEMINI_HTTP_${res.status}`);
          await sleep(RETRY_DELAY_MS[attempt - 1] ?? 3000);
          continue;
        }
        if (res.status === 429) throw new Error('GEMINI_QUOTA_EXCEEDED');
        throw new Error(`GEMINI_HTTP_${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      if (err?.message === 'GEMINI_API_KEY_INVALID') throw err;
      if (attempt < MAX_ATTEMPTS && (err?.name === 'AbortError' || err instanceof TypeError)) {
        lastError = err;
        await sleep(RETRY_DELAY_MS[attempt - 1] ?? 3000);
        continue;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError ?? new Error('GEMINI_UNKNOWN');
}

function parseGeminiDraft(json: any): TomografiDraft {
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    // eslint-disable-next-line no-console
    console.error('Gemini yanıtında metin yok:', JSON.stringify(json).slice(0, 500));
    return { examTitle: '', findings: [], sonucLines: [], reportDate: '' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // eslint-disable-next-line no-console
    console.error('Gemini yanıtı JSON olarak ayrıştırılamadı:', String(text).slice(0, 500));
    return { examTitle: '', findings: [], sonucLines: [], reportDate: '' };
  }

  // reportDate sadece geçerli "YYYY-MM-DD" biçimindeyse kabul edilir —
  // Gemini beklenmedik bir biçim döndürürse (istem dışı) sessizce boş
  // bırakılır, arayüz o zaman yükleme tarihine geri döner.
  const rawDate = String(parsed?.reportDate ?? '').trim();
  const reportDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : '';

  return {
    examTitle: String(parsed?.examTitle ?? '').trim(),
    findings: Array.isArray(parsed?.findings)
      ? parsed.findings.map((s: any) => String(s ?? '').trim()).filter(Boolean)
      : [],
    sonucLines: Array.isArray(parsed?.sonucLines)
      ? parsed.sonucLines.map((s: any) => String(s ?? '').trim()).filter(Boolean)
      : [],
    reportDate,
  };
}

// .docx'ten çıkarılmış düz metni Gemini'ye gönderip ayırır.
export async function segmentTomografiReport(rawText: string): Promise<TomografiDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');
  if (!rawText || !rawText.trim()) {
    return { examTitle: '', findings: [], sonucLines: [], reportDate: '' };
  }

  const prompt = `${INSTRUCTIONS}\n\nRapor metni:\n"""\n${rawText.slice(0, 20_000)}\n"""`;
  const json = await callGemini(apiKey, [{ text: prompt }]);
  return parseGeminiDraft(json);
}

// PDF dosyasını (metin çıkarma adımı olmadan) doğrudan Gemini'ye gönderip
// ayırır — hem düz metinli hem taranmış/fotoğraflanmış PDF'lerde çalışır.
export async function segmentTomografiFromPdf(pdfBytes: Buffer): Promise<TomografiDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');

  const json = await callGemini(apiKey, [
    { text: INSTRUCTIONS },
    { inline_data: { mime_type: 'application/pdf', data: pdfBytes.toString('base64') } },
  ]);
  return parseGeminiDraft(json);
}
