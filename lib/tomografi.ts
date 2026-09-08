// e-Klinik "Tomografi Raporu" özelliği: personelin yüklediği düz metin
// Word (.docx) tomografi raporunu, Trakya Hayvan Hastanesi'nin kendi
// tasarım şablonuna göre biçimlendirilmiş bir PDF'e çevirir.
//
// İki adım var:
//   1) extractDocxText(): .docx dosyasının içindeki düz metni çıkarır
//      (mammoth kütüphanesi ile — Word'ün XML formatını okuyup metne
//      çeviriyor, biçimlendirmeyi/stilleri değil, sadece metni alıyoruz).
//   2) segmentTomografiReport(): o düz metni Gemini'ye gönderip üç parçaya
//      ayırıyor: incelemenin başlığı (ör. "KRANİAL BT"), bulgular
//      paragrafları ve "Sonuç" satırları. Bu, personelin serbest biçimde
//      yazdığı bir raporun (başlıklar/boşluklar kişiden kişiye değişebilir)
//      güvenilir şekilde şablona oturtulmasını sağlıyor.
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
  },
  required: ['examTitle', 'findings', 'sonucLines'],
};

const PROMPT = `Aşağıda bir veteriner hastanesine ait TOMOGRAFİ (BT) raporunun düz metni var. Bu metni şu 3 parçaya ayır:

1) examTitle: incelemenin kısa başlığı/türü (ör. "KRANİAL BT", "TORAKS BT", "ABDOMEN BT"). Genelde metnin en başında kısa, büyük harfli bir satır olarak bulunur. Yoksa, metnin içeriğine bakarak en uygun kısa başlığı sen oluştur.
2) findings: bulgular/inceleme paragrafları — orijinal cümleleri DEĞİŞTİRMEDEN, mantıklı paragraflara ayırarak bir dizi metin parçası olarak ver.
3) sonucLines: "Sonuç" veya "Değerlendirme" başlığından sonra gelen nihai değerlendirme cümle(leri) — her biri ayrı bir dizi elemanı olarak.

Rapor sonunda genelde bulunan sabit yasal uyarı/feragat cümlelerini (ör. "değerlendirme mevcut teknik olanaklar ve tıbbi bilgiler doğrultusunda yapılmıştır", "...klinik, muayene, laboratuvar ve varsa patoloji bulguları ile değerlendirilmesi önerilir" gibi) sonucLines veya findings içine DAHİL ETME — bunlar zaten şablonda sabit olarak var. Hasta/hasta sahibi adı, tarih gibi bilgileri de dahil etme, sadece tıbbi metni işle. Orijinal metindeki cümleleri olduğu gibi koru, uydurma veya özetleme yapma; metin boşsa veya anlamsızsa examTitle'ı boş, findings ve sonucLines'ı boş dizi döndür.

Rapor metni:
"""
`;

async function callGemini(apiKey: string, rawText: string): Promise<any> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: PROMPT + rawText + '\n"""' }] }],
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

export async function segmentTomografiReport(rawText: string): Promise<TomografiDraft> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY_MISSING');
  if (!rawText || !rawText.trim()) {
    return { examTitle: '', findings: [], sonucLines: [] };
  }

  const json = await callGemini(apiKey, rawText.slice(0, 20_000));
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    // eslint-disable-next-line no-console
    console.error('Gemini yanıtında metin yok:', JSON.stringify(json).slice(0, 500));
    return { examTitle: '', findings: [], sonucLines: [] };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    // eslint-disable-next-line no-console
    console.error('Gemini yanıtı JSON olarak ayrıştırılamadı:', String(text).slice(0, 500));
    return { examTitle: '', findings: [], sonucLines: [] };
  }

  return {
    examTitle: String(parsed?.examTitle ?? '').trim(),
    findings: Array.isArray(parsed?.findings)
      ? parsed.findings.map((s: any) => String(s ?? '').trim()).filter(Boolean)
      : [],
    sonucLines: Array.isArray(parsed?.sonucLines)
      ? parsed.sonucLines.map((s: any) => String(s ?? '').trim()).filter(Boolean)
      : [],
  };
}
