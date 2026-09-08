// e-Klinik "Dijitalleştir" özelliği: taranmış/fotoğraflanmış bir kan
// tahlili sayfasındaki yazıyı okuyup düzenli bir tabloya çevirir.
//
// Bilinçli olarak ücretsiz, hesap/API anahtarı gerektirmeyen bir motor
// (Tesseract OCR, tesseract.js üzerinden) kullanılıyor. Varsayılan olarak
// tesseract.js, çalışma anında dil verisini ve WASM motorunu jsdelivr
// CDN'den indirir — bu hem yavaş/kırılgan hem de bazı ağlarda engelleniyor.
// Bunun yerine gerekli tüm dosyalar (motor + İngilizce/Türkçe dil verisi)
// public/tesseract/ altında UYGULAMAYLA BİRLİKTE paketlendi; OCR çalışırken
// hiçbir dış siteye bağlanmıyor, sadece kendi alan adımızdan (Vercel) statik
// dosya okuyor.
//
// ÖNEMLİ GÜVENLİK NOTU: OCR hiçbir zaman %100 doğru okumaz — bu yüzden bu
// modülün ürettiği satırlar HER ZAMAN personel tarafından gözden geçirilip
// gerekirse düzeltildikten sonra "Onayla ve Kaydet" ile kaydedilmeli
// (bkz. components/OcrReviewPanel.tsx, lib/actions/ocr.ts). Otomatik olarak
// hiçbir değer, personel onayı olmadan hastanın kalıcı kaydına yazılmaz.
import { createWorker } from 'tesseract.js';
// NOT: sharp bilerek STATİK değil, aşağıda DİNAMİK olarak import ediliyor.
// sharp, platforma özgü bir native (derlenmiş) ikili dosya kullanıyor;
// bu ikili herhangi bir sebeple (paketleme/platform uyuşmazlığı) yüklenemezse
// modül en üstte `import sharp from 'sharp'` yapılmış olsaydı bu dosyanın
// TAMAMI, dolayısıyla onu kullanan Server Action da çalışma anında
// yüklenemez hale gelirdi — bu da personele "Cannot use 'in' operator ...
// in undefined" gibi anlaşılmaz, hiçbir işe yaramayan bir hata olarak
// yansırdı. Dinamik import + try/catch ile sharp yüklenemese bile OCR'ın
// geri kalanı (ön işleme adımı atlanarak) çalışmaya devam edebiliyor.

function assetBaseUrl() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://vetora-live.vercel.app';
  return `${appUrl.replace(/\/$/, '')}/tesseract`;
}

// Telefon kamerasıyla çekilmiş bir fotoğraf çoğu zaman OCR için gereğinden
// çok daha büyük çözünürlükte olur — hem işlem süresini gereksiz uzatır hem
// de sunucusuz fonksiyonun zaman sınırına yaklaşma riskini artırır. Uzun
// kenarı 2200px'e indirip griye çeviriyoruz: OCR doğruluğunu neredeyse hiç
// etkilemiyor (yazı zaten siyah/beyaz), ama işlemi belirgin şekilde
// hızlandırıyor.
async function preprocessForOcr(imageBytes: Buffer | Uint8Array): Promise<Buffer> {
  try {
    const sharpModule = await import('sharp');
    const sharp = sharpModule.default;
    return await sharp(Buffer.from(imageBytes))
      .rotate() // EXIF yönlendirmesine göre düzelt
      .resize({ width: 2200, height: 2200, fit: 'inside', withoutEnlargement: true })
      .grayscale()
      .toFormat('png')
      .toBuffer();
  } catch (err) {
    // Ön işleme başarısız olursa (ör. desteklenmeyen/bozuk bir format ya da
    // sharp'ın native modülü bu ortamda yüklenemediyse), OCR'ı orijinal
    // dosya ile denemeye devam edelim — hiç sonuç vermemektense biraz daha
    // yavaş da olsa denemek daha iyi.
    // eslint-disable-next-line no-console
    console.error('OCR ön işleme (sharp) atlandı:', err);
    return Buffer.from(imageBytes);
  }
}

export async function runOcr(imageBytes: Buffer | Uint8Array): Promise<string> {
  const base = assetBaseUrl();
  const processed = await preprocessForOcr(imageBytes);
  const worker = await createWorker('eng+tur', 1, {
    corePath: `${base}/tesseract-core.wasm.js`,
    langPath: base,
    gzip: true,
    // tesseract.js varsayılan olarak indirdiği dil verisini ÇALIŞMA
    // DİZİNİNE ('.') yazıp önbelleğe alır. Vercel'in sunucusuz
    // fonksiyonlarında dağıtılan kod salt-okunurdur, sadece /tmp
    // yazılabilir — bu yüzden cachePath'i açıkça /tmp'ye sabitliyoruz,
    // yoksa üretimde "EROFS: read-only file system" hatasıyla çöker.
    cachePath: '/tmp',
  });
  try {
    const { data } = await worker.recognize(processed);
    return data.text || '';
  } finally {
    await worker.terminate();
  }
}

export type LabRow = { name: string; result: string; range: string; unit: string };

// Kan tahlili raporlarında en sık görülen satır kalıpları için basit,
// kural tabanlı bir ayrıştırıcı (yapay zeka değil — sadece düzenli ifade
// eşleştirmesi). Mükemmel değildir; bu yüzden ayrıştıramadığı satırları da
// (result/range/unit boş, sadece "name" alanında ham metinle) döndürür,
// böylece hiçbir satır sessizce kaybolmaz — personel ekranda hepsini görür
// ve gerekirse elle düzeltir/siler.
export function parseLabRows(rawText: string): LabRow[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const rows: LabRow[] = [];

  // Örnek eşleşen satırlar:
  //   "WBC 8.2 6.0 - 17.0 10^3/uL"
  //   "GLUKOZ  98  70-120  mg/dL"
  //   "HGB: 14.1 g/dL (12.0-18.0)"
  const pattern1 =
    /^([A-Za-zÇĞİÖŞÜçğıöşü().\/%\s]{2,40}?)[\s:]+([\d.,]+)\s+([\d.,]+\s*-\s*[\d.,]+)\s*([A-Za-zµ°%^*0-9\/]*)\s*$/;
  // "İSİM: DEĞER BİRİM" (referans aralığı olmadan)
  const pattern2 = /^([A-Za-zÇĞİÖŞÜçğıöşü().\/%\s]{2,40}?)[\s:]+([\d.,]+)\s*([A-Za-zµ°%^*0-9\/]*)\s*$/;

  for (const line of lines) {
    const m1 = line.match(pattern1);
    if (m1) {
      rows.push({ name: m1[1].trim(), result: m1[2].trim(), range: m1[3].replace(/\s+/g, '').trim(), unit: m1[4].trim() });
      continue;
    }
    const m2 = line.match(pattern2);
    if (m2) {
      rows.push({ name: m2[1].trim(), result: m2[2].trim(), range: '', unit: m2[3].trim() });
      continue;
    }
    // Eşleşmedi — başlık, hasta bilgisi ya da tanınmayan bir satır olabilir.
    // Yine de kaybetmeyelim: sadece "name" alanına ham satırı koyuyoruz,
    // personel ekranda görüp isterse silebilir.
    rows.push({ name: line, result: '', range: '', unit: '' });
  }

  return rows;
}
