// e-Klinik "Dijitalleştir" özelliği: taranmış/fotoğraflanmış bir kan
// tahlili sayfasındaki yazıyı okuyup düzenli bir tabloya çevirir.
//
// Google Gemini'nin görüntü anlama özelliğini kullanıyor. Daha önce kendi
// sunucumuzda çalışan ücretsiz bir motor (Tesseract) denenmişti, ama
// Vercel'in paylaşımlı/sınırlı sunucusuz fonksiyonunda çok yavaş kalıyor ve
// büyük fotoğraflarda sürekli zaman aşımına uğruyordu. Gemini, Google'ın
// kendi devasa (GPU'lu) sunucularında çalıştığı için hem çok daha hızlı hem
// de çok daha doğru okuyor — üstelik makul kullanım için ücretsiz bir
// kotası var (kredi kartı istemiyor).
//
// ÇALIŞMASI İÇİN GEREKEN AYAR: Vercel proje ayarlarında (Settings →
// Environment Variables) GEMINI_API_KEY adında bir ortam değişkeni
// tanımlı olmalı. Anahtar https://aistudio.google.com/apikey adresinden
// ücretsiz alınabilir. Tanımlı değilse bu modül aşağıda anlaşılır bir hata
// fırlatır (bkz. lib/actions/ocr.ts, kullanıcıya gösterilen Türkçe mesaj).
//
// ÖNEMLİ GÜVENLİK NOTU: yapay zeka hiçbir zaman %100 doğru okumaz — bu
// yüzden bu modülün ürettiği satırlar HER ZAMAN personel tarafından gözden
// geçirilip gerekirse düzeltildikten sonra "Onayla ve Kaydet" ile
// kaydedilmeli (bkz. components/OcrReviewPanel.tsx, lib/actions/ocr.ts).
// Otomatik olarak hiçbir değer, personel onayı olmadan hastanın kalıcı
// kaydına yazılmaz.

export type LabRow = { name: string; result: string; range: string; unit: string };

// "gemini-flash-latest" Google'ın her zaman en güncel, kararlı Flash
// modeline işaret eden bir takma ad — sabit bir sürüm numarası
// (ör. "gemini-2.0-flash") yazmak yerine bunu kullanmak, Google yeni bir
// sürüm çıkardığında kodu elle güncellemek zorunda kalmamamızı sağlıyor.
const GEMINI_MODEL = 'gemini-flash-latest';

function logStep(label: string, startedAt: number) {
  // eslint-disable-next-line no-console
  console.log(`[Dijitalleştir] ${label}: ${Date.now() - startedAt}ms (toplam)`);
}

// Telefon kamerasıyla çekilmiş bir fotoğraf çoğu zaman gereğinden çok daha
// yüksek çözünürlükte olur — bu hem Gemini'ye gönderilecek veriyi
// büyütüp isteği yavaşlatır hem de tek istekteki 20MB sınırına yaklaşma
// riskini artırır. Uzun kenarı 2000px'e indirip sıkıştırılmış JPEG'e
// çeviriyoruz. sharp'ın native modülü herhangi bir sebeple bu ortamda
// yüklenemezse (ör. paketleme sorunu), ön işlemeyi atlayıp orijinal dosyayı
// olduğu gibi gönderiyoruz — hiç sonuç vermemektense bu daha iyi.
async function preprocessImage(imageBytes: Buffer | Uint8Array): Promise<{ bytes: Buffer; mimeType: string }> {
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;
    const out = await sharp(Buffer.from(imageBytes))
      .rotate()
      .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return { bytes: out, mimeType: 'image/jpeg' };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Görüntü ön işleme (sharp) atlandı, orijinal dosya gönderiliyor:', err);
    return { bytes: Buffer.from(imageBytes), mimeType: 'image/jpeg' };
  }
}

// Gemini'ye "sadece bu şekle uygun JSON döndür" demek için kullanılan şema
// — bu sayede kendi regex tabanlı bir ayrıştırıcıya (eski Tesseract
// yaklaşımı) ihtiyaç kalmıyor, Gemini satırları doğrudan yapılandırılmış
// olarak veriyor.
const RESPONSE_SCHEMA = {
  type: 'ARRAY',
  items: {
    type: 'OBJECT',
    properties: {
      name: { type: 'STRING' },
      result: { type: 'STRING' },
      range: { type: 'STRING' },
      unit: { type: 'STRING' },
    },
    required: ['name', 'result', 'range', 'unit'],
  },
};

const PROMPT = `Bu görselde bir veteriner hastanesine ait kan tahlili / laboratuvar sonucu belgesi var. Belgede yer alan HER test satırını çıkar. Her satır için şu alanları doldur:
- name: testin adı (ör. "WBC", "Glukoz", "ALT")
- result: ölçülen sonuç değeri
- range: varsa referans aralığı (ör. "6.0-17.0"), yoksa boş metin
- unit: varsa birim (ör. "mg/dL", "10^3/uL"), yoksa boş metin
Sadece belgede GERÇEKTEN yazılı olan bilgiyi çıkar; hiçbir değeri tahmin etme veya uydurma. Hasta adı, tarih, hastane adı gibi test satırı olmayan bilgileri dahil etme. Belgeyi okuyamıyorsan ya da hiç test satırı yoksa boş bir liste ([]) döndür.`;

export async function extractLabRowsWithGemini(imageBytes: Buffer | Uint8Array): Promise<LabRow[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY_MISSING');
  }
  const t0 = Date.now();
  const { bytes, mimeType } = await preprocessImage(imageBytes);
  logStep('görüntü ön işleme bitti', t0);

  const controller = new AbortController();
  // Gemini normalde birkaç saniyede yanıt veriyor; yine de ağ takılırsa
  // sunucusuz fonksiyonun kendi sert süre sınırı (maxDuration) tarafından
  // hiç açıklama vermeden kesilmek yerine kendi kontrollü zaman aşımımızı
  // koyuyoruz.
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: PROMPT }, { inline_data: { mime_type: mimeType, data: bytes.toString('base64') } }],
            },
          ],
          generationConfig: {
            response_mime_type: 'application/json',
            response_schema: RESPONSE_SCHEMA,
            temperature: 0,
          },
        }),
      }
    );
    logStep('Gemini API yanıtı alındı', t0);

    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      // eslint-disable-next-line no-console
      console.error('Gemini API hata döndürdü:', res.status, errBody);
      if (res.status === 400 && /API key not valid/i.test(errBody)) {
        throw new Error('GEMINI_API_KEY_INVALID');
      }
      if (res.status === 429) {
        throw new Error('GEMINI_QUOTA_EXCEEDED');
      }
      throw new Error(`GEMINI_HTTP_${res.status}`);
    }

    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      // eslint-disable-next-line no-console
      console.error('Gemini yanıtında metin yok:', JSON.stringify(json).slice(0, 500));
      return [];
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      // eslint-disable-next-line no-console
      console.error('Gemini yanıtı JSON olarak ayrıştırılamadı:', String(text).slice(0, 500));
      return [];
    }
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((r: any) => ({
        name: String(r?.name ?? '').trim(),
        result: String(r?.result ?? '').trim(),
        range: String(r?.range ?? '').trim(),
        unit: String(r?.unit ?? '').trim(),
      }))
      .filter((r) => r.name.length > 0);
  } finally {
    clearTimeout(timeout);
  }
}
