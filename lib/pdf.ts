// e-Klinik "Dijitalleştir" sonucunu, MED CARE ANIMALS logolu, yazdırılabilir
// tek sayfalık bir PDF'e döken yardımcı fonksiyon. pdf-lib kullanıyoruz
// (saf JS, native bağımlılık yok — Vercel'in sunucusuz fonksiyonlarında
// sorunsuz çalışır).
//
// pdf-lib'in yerleşik 14 standart fontu (Helvetica vb.) WinAnsi kod
// sayfasını kullanır ve Türkçe'ye özgü ı/İ/ğ/Ğ/ş/Ş harflerini İÇERMEZ —
// bu harflerden biri geçen bir metin çizilmeye çalışılırsa pdf-lib hata
// fırlatıp PDF oluşturmayı tamamen durdurur. Bunun yerine DejaVu Sans (geniş
// Unicode kapsamlı, serbest lisanslı) fontunu fontkit ile gömüyoruz —
// hasta/hasta sahibi adları ve Türkçe etiketler (örn. "Referans Aralığı")
// güvenle basılabiliyor.
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { LabRow } from './ocr';

const NAVY = rgb(0x13 / 255, 0x1c / 255, 0x3b / 255);
const ACCENT = rgb(0x2f / 255, 0x5f / 255, 0xe0 / 255);
const TEXT2 = rgb(0x57 / 255, 0x62 / 255, 0x8a / 255);
const BORDER = rgb(0xe1 / 255, 0xe7 / 255, 0xf4 / 255);

export async function buildLabResultPdf(opts: {
  patientName: string;
  ownerName: string;
  species?: string | null;
  title: string;
  categoryLabel: string;
  takenAt: string | null;
  rows: LabRow[];
  logoPngBytes: ArrayBuffer;
  fontRegularBytes: ArrayBuffer;
  fontBoldBytes: ArrayBuffer;
}): Promise<Uint8Array> {
  const { patientName, ownerName, species, title, categoryLabel, takenAt, rows, logoPngBytes, fontRegularBytes, fontBoldBytes } =
    opts;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const page = pdf.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(fontRegularBytes, { subset: true });
  const fontBold = await pdf.embedFont(fontBoldBytes, { subset: true });
  const logo = await pdf.embedPng(logoPngBytes);

  let y = height - 50;
  const marginX = 48;

  // Başlık / logo
  const logoSize = 34;
  page.drawImage(logo, { x: marginX, y: y - logoSize + 6, width: logoSize, height: logoSize });
  page.drawText('MED CARE ANIMALS', {
    x: marginX + logoSize + 10,
    y: y - 6,
    size: 16,
    font: fontBold,
    color: NAVY,
  });
  page.drawText('e-Klinik — Dijitalleştirilmiş Belge', {
    x: marginX + logoSize + 10,
    y: y - 24,
    size: 9,
    font,
    color: TEXT2,
  });
  y -= logoSize + 20;

  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: BORDER });
  y -= 22;

  const infoLine = (label: string, value: string) => {
    page.drawText(label, { x: marginX, y, size: 9, font: fontBold, color: TEXT2 });
    page.drawText(value || '—', { x: marginX + 90, y, size: 10, font, color: NAVY });
    y -= 16;
  };
  infoLine('Hasta:', patientName + (species ? ` (${species})` : ''));
  infoLine('Hasta Sahibi:', ownerName);
  infoLine('Belge Türü:', categoryLabel);
  infoLine('Başlık:', title);
  infoLine('Tarih:', takenAt ? new Date(takenAt).toLocaleDateString('tr-TR') : '—');

  y -= 10;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: BORDER });
  y -= 24;

  // Tablo başlıkları
  const col = { name: marginX, result: marginX + 220, range: marginX + 320, unit: marginX + 440 };
  page.drawText('Test Adı', { x: col.name, y, size: 10, font: fontBold, color: NAVY });
  page.drawText('Sonuç', { x: col.result, y, size: 10, font: fontBold, color: NAVY });
  page.drawText('Referans Aralığı', { x: col.range, y, size: 10, font: fontBold, color: NAVY });
  page.drawText('Birim', { x: col.unit, y, size: 10, font: fontBold, color: NAVY });
  y -= 8;
  page.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: ACCENT });
  y -= 18;

  const lineHeight = 18;
  const bottomLimit = 90;
  let currentPage = page;

  for (const row of rows) {
    if (y < bottomLimit) {
      currentPage = pdf.addPage([595.28, 841.89]);
      y = height - 50;
      currentPage.drawText('Test Adı', { x: col.name, y, size: 10, font: fontBold, color: NAVY });
      currentPage.drawText('Sonuç', { x: col.result, y, size: 10, font: fontBold, color: NAVY });
      currentPage.drawText('Referans Aralığı', { x: col.range, y, size: 10, font: fontBold, color: NAVY });
      currentPage.drawText('Birim', { x: col.unit, y, size: 10, font: fontBold, color: NAVY });
      y -= 8;
      currentPage.drawLine({ start: { x: marginX, y }, end: { x: width - marginX, y }, thickness: 1, color: ACCENT });
      y -= 18;
    }
    const name = truncate(row.name, 34);
    currentPage.drawText(name, { x: col.name, y, size: 9.5, font, color: NAVY });
    currentPage.drawText(row.result || '—', { x: col.result, y, size: 9.5, font, color: NAVY });
    currentPage.drawText(row.range || '—', { x: col.range, y, size: 9.5, font, color: TEXT2 });
    currentPage.drawText(row.unit || '—', { x: col.unit, y, size: 9.5, font, color: TEXT2 });
    y -= lineHeight;
  }

  // Alt bilgi notu (her sayfaya son sayfada bir kez yeterli)
  currentPage.drawText(
    'Bu belge, taranmış/fotoğraflanmış orijinal belgeden otomatik metne çevrilmiş ve klinik personeli',
    { x: marginX, y: 56, size: 7.5, font, color: TEXT2 }
  );
  currentPage.drawText(
    'tarafından kontrol edilerek onaylanmıştır. Orijinal belge de sistemde ayrıca arşivlenmektedir.',
    { x: marginX, y: 46, size: 7.5, font, color: TEXT2 }
  );

  return pdf.save();
}

function truncate(s: string, max: number) {
  if (!s) return '';
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}
