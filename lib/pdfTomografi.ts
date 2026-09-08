// "Tomografi Raporu" (BT Raporu) — Trakya Hayvan Hastanesi'nin kendi
// tasarım şablonuna göre biçimlendirilmiş, yazdırılabilir PDF üretir.
//
// NOT — marka ayrımı bilinçli bir tercih: bu belge özellikle "Trakya
// Hayvan Hastanesi" marka/logosunu kullanıyor, sistemin geri kalanı
// (kan tahlili PDF'leri, hasta sahibi linki vb.) hâlâ "MED CARE ANIMALS"
// markasını kullanmaya devam ediyor — bu, kullanıcının kendi isteğiyle
// belirlediği bir karar (bkz. proje notları).
//
// Üstteki renkli/logolu başlık bandı (public/brand/trakya-bt-header.jpg),
// orijinal şablon PDF'inden aynen alınmış SABİT bir görsel — hiç metin
// içermiyormuş gibi davranıp üzerine yeniden yazı yazmıyoruz, çünkü o
// bant zaten hazır "BT RAPORU" başlığını ve logoyu içeriyor. Bunun altındaki
// HER ŞEY (tarih, hasta bilgileri, bulgular, sonuç) bu fonksiyonla, her
// raporda değişen gerçek veriyle, gerçek metin olarak çiziliyor.
//
// Şablondaki özel/ücretli font (CS Rocky Vintage) burada KULLANILMIYOR —
// yerine, benzer kalın/yuvarlak/canlı hissi veren, Türkçe karakterleri
// tam destekleyen ücretsiz "Baloo 2" fontu (Google Fonts) kullanılıyor.
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

const PAGE_W = 595.5;
const PAGE_H = 841.92;
const MARGIN_X = 32;

const BLACK = rgb(0, 0, 0);
const GREEN = rgb(0x89 / 255, 0xba / 255, 0x3f / 255);
const LABEL_GRAY = rgb(0x5b / 255, 0x5b / 255, 0x5a / 255);
const BODY_GRAY = rgb(0x59 / 255, 0x59 / 255, 0x59 / 255);
const FOOTER_GRAY = rgb(0x54 / 255, 0x54 / 255, 0x54 / 255);
const DIVIDER = rgb(0.749, 0.7647, 0.7843);
const PILL_BG = rgb(0.92, 0.92, 0.92);

const TR_MONTHS = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

export function formatDatePill(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${TR_MONTHS[d.getMonth()]} ${d.getFullYear()}`.toUpperCase();
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export async function buildTomografiPdf(opts: {
  ownerName: string;
  petName: string;
  reportDate: string | null;
  examTitle: string;
  findings: string[];
  sonucLines: string[];
  headerImageBytes: ArrayBuffer;
  fontRegularBytes: ArrayBuffer;
  fontBoldBytes: ArrayBuffer;
}): Promise<Uint8Array> {
  const { ownerName, petName, reportDate, examTitle, findings, sonucLines, headerImageBytes, fontRegularBytes, fontBoldBytes } =
    opts;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const fontRegular = await pdf.embedFont(fontRegularBytes, { subset: false });
  const fontBold = await pdf.embedFont(fontBoldBytes, { subset: false });
  const headerImage = await pdf.embedJpg(headerImageBytes);

  let page = pdf.addPage([PAGE_W, PAGE_H]);
  const contentWidth = PAGE_W - MARGIN_X * 2;
  const bottomLimit = 110;

  // Üst renkli/logolu marka bandı — sabit görsel, her sayfada aynı.
  function drawHeaderBand(p: PDFPage) {
    const bandHeight = (headerImage.height / headerImage.width) * PAGE_W;
    p.drawImage(headerImage, { x: 0, y: PAGE_H - bandHeight, width: PAGE_W, height: bandHeight });
    return bandHeight;
  }

  const bandHeight = drawHeaderBand(page);
  let y = PAGE_H - bandHeight - 24;

  // HASTA BİLGİLERİ etiketi + tarih "hapı"
  page.drawText('HASTA BİLGİLERİ', { x: MARGIN_X, y, size: 12, font: fontBold, color: LABEL_GRAY });
  const dateLabel = formatDatePill(reportDate);
  if (dateLabel) {
    const pillFontSize = 11;
    const textWidth = fontBold.widthOfTextAtSize(dateLabel, pillFontSize);
    const pillPaddingX = 12;
    const pillW = textWidth + pillPaddingX * 2;
    const pillH = 22;
    const pillX = PAGE_W - MARGIN_X - pillW;
    const pillY = y - 6;
    page.drawRectangle({ x: pillX, y: pillY, width: pillW, height: pillH, color: PILL_BG });
    page.drawText(dateLabel, {
      x: pillX + pillPaddingX,
      y: pillY + 6,
      size: pillFontSize,
      font: fontBold,
      color: BLACK,
    });
  }
  y -= 22;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, thickness: 1, color: DIVIDER });
  y -= 24;

  // Hasta sahibi + hasta (pet) adı
  page.drawText(ownerName || '—', { x: MARGIN_X, y, size: 14, font: fontBold, color: BLACK });
  y -= 20;
  page.drawText(petName || '—', { x: MARGIN_X, y, size: 12, font: fontBold, color: GREEN });
  y -= 22;
  page.drawLine({ start: { x: MARGIN_X, y }, end: { x: PAGE_W - MARGIN_X, y }, thickness: 1, color: DIVIDER });
  y -= 36;

  // İnceleme başlığı (ör. "KRANİAL BT")
  page.drawText((examTitle || 'BT İNCELEMESİ').toLocaleUpperCase('tr-TR'), {
    x: MARGIN_X,
    y,
    size: 18,
    font: fontBold,
    color: BLACK,
  });
  y -= 34;

  function ensureSpace(needed: number) {
    if (y - needed < bottomLimit) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - 50;
      page.drawText('Trakya Hayvan Hastanesi — BT Raporu (devamı)', {
        x: MARGIN_X,
        y,
        size: 9,
        font: fontRegular,
        color: LABEL_GRAY,
      });
      y -= 26;
    }
  }

  const bodyLineHeight = 15;
  for (const paragraph of findings) {
    const lines = wrapText(paragraph, fontRegular, 10.5, contentWidth);
    ensureSpace(lines.length * bodyLineHeight + 8);
    for (const line of lines) {
      page.drawText(line, { x: MARGIN_X, y, size: 10.5, font: fontRegular, color: BODY_GRAY });
      y -= bodyLineHeight;
    }
    y -= 6;
  }

  if (sonucLines.length > 0) {
    y -= 10;
    ensureSpace(30);
    page.drawText('Sonuç:', { x: MARGIN_X, y, size: 12, font: fontBold, color: BLACK });
    y -= 20;
    for (const line of sonucLines) {
      const lines = wrapText(`•  ${line}`, fontRegular, 11, contentWidth - 10);
      ensureSpace(lines.length * bodyLineHeight + 4);
      for (const l of lines) {
        page.drawText(l, { x: MARGIN_X + 4, y, size: 11, font: fontRegular, color: BLACK });
        y -= bodyLineHeight;
      }
    }
  }

  // Alt bilgi / feragat notu — her zaman son sayfanın en altında sabit.
  if (y < 130) {
    page = pdf.addPage([PAGE_W, PAGE_H]);
  }
  const footerLines = [
    'Değerlendirme mevcut teknik olanaklar ve tıbbi bilgiler doğrultusunda yapılmıştır.',
    'İncelemenin hastanın klinik, muayene, laboratuvar ve varsa patoloji bulguları ile',
    'değerlendirilmesi önerilir.',
  ];
  let footerY = 70;
  for (const line of footerLines) {
    page.drawText(line, { x: MARGIN_X, y: footerY, size: 8.5, font: fontRegular, color: FOOTER_GRAY });
    footerY -= 12;
  }

  return pdf.save();
}
