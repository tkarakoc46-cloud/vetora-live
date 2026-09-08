'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { runOcr, parseLabRows, type LabRow } from '@/lib/ocr';
import { buildLabResultPdf } from '@/lib/pdf';

const CATEGORY_LABEL: Record<string, string> = {
  kan_tahlili: 'Kan Tahlili',
  tomografi: 'Tomografi',
  rontgen: 'Röntgen',
  diger: 'Diğer',
};

// Adım 1: personel "Dijitalleştir" butonuna bastığında çağrılır. Orijinal
// belgeyi Storage'dan indirir, OCR ile metne çevirir ve satırlara ayırır.
// HİÇBİR ŞEY KAYDETMEZ — sadece sonucu ekrana döner, personel gözden
// geçirsin/düzeltsin diye (bkz. components/OcrReviewPanel.tsx).
export async function extractLabResultTable(
  labResultId: string
): Promise<{ rawText: string; rows: LabRow[] } | { error: string }> {
  // Bütün gövde tek bir try/catch içinde: burada beklenmedik BİR TEK
  // istisna bile fonksiyonun hiçbir şey döndürmeden (undefined) bitmesine
  // yol açabiliyordu — bu da tarayıcı tarafında "Cannot use 'in' operator
  // ... in undefined" gibi anlaşılmaz bir hataya dönüşüyordu. Artık ne
  // olursa olsun her zaman { error } ya da geçerli sonuç dönüyor.
  const t0 = Date.now();
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Oturumunuz sona ermiş görünüyor. Lütfen sayfayı yenileyip tekrar giriş yapın.' };
    // eslint-disable-next-line no-console
    console.log(`[Dijitalleştir] ${Date.now() - t0}ms: kullanıcı doğrulandı`);

    const { data: labResult, error: fetchError } = await supabase
      .from('lab_results')
      .select('storage_path, file_name')
      .eq('id', labResultId)
      .single();
    if (fetchError || !labResult) {
      return { error: 'Belge bulunamadı: ' + (fetchError?.message ?? 'bilinmeyen hata') };
    }

    const nameLower = (labResult.file_name || '').toLowerCase();
    const looksLikePdf = nameLower.endsWith('.pdf');
    if (looksLikePdf) {
      return {
        error:
          'PDF belgeler için otomatik metne çevirme henüz desteklenmiyor — bu özellik sadece fotoğraf/resim belgeler içindir.',
      };
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lab-results')
      .download(labResult.storage_path);
    if (downloadError || !fileData) {
      return { error: 'Belge indirilemedi: ' + (downloadError?.message ?? 'bilinmeyen hata') };
    }
    // eslint-disable-next-line no-console
    console.log(`[Dijitalleştir] ${Date.now() - t0}ms: dosya Storage'dan indirildi`);

    const bytes = Buffer.from(await fileData.arrayBuffer());
    // eslint-disable-next-line no-console
    console.log(`[Dijitalleştir] ${Date.now() - t0}ms: arrayBuffer() bitti, OCR başlıyor`);
    // OCR, çok büyük/yüksek çözünürlüklü bir fotoğrafta beklenenden uzun
    // sürebiliyor. Sunucusuz fonksiyonun kendi süre sınırının (maxDuration)
    // bizi sert bir şekilde, hiçbir düzgün hata döndürmeden kesmesini
    // beklemek yerine, kendi iç zaman aşımımızı koyuyoruz — böylece kullanıcı
    // her zaman anlaşılır bir mesaj görür.
    const rawText = await Promise.race([
      runOcr(bytes),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('OCR_TIMEOUT')), 50_000)
      ),
    ]);
    if (!rawText.trim()) {
      return {
        error:
          'Belgede okunabilir bir yazı bulunamadı. Fotoğrafın net, düz ve iyi aydınlatılmış olduğundan emin olup tekrar deneyin.',
      };
    }
    const rows = parseLabRows(rawText);
    return { rawText, rows };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('extractLabResultTable failed', err);
    if (err?.message === 'OCR_TIMEOUT') {
      return {
        error:
          'Bu belge çok uzun sürdüğü için işlem durduruldu (büyük ihtimalle fotoğraf çok yüksek çözünürlüklü). Lütfen daha küçük/az detaylı bir fotoğrafla tekrar deneyin.',
      };
    }
    return { error: 'Metne çevirme başarısız oldu: ' + (err?.message ?? String(err)) };
  }
}

// Adım 2: personel, ekrandaki tabloyu gözden geçirip (gerekirse düzelttikten)
// sonra "Onayla ve PDF Oluştur" dediğinde çağrılır. MED CARE ANIMALS logolu
// bir PDF üretir, arşive yükler ve lab_results tablosuna YENİ bir satır
// olarak ekler — orijinal taranmış belge silinmez, ikisi de arşivde kalır.
export async function saveDigitalLabResult(
  patientId: string,
  input: { rows: LabRow[]; title: string; category: string; takenAt: string }
): Promise<{ error: string } | { ok: true }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Oturumunuz sona ermiş görünüyor. Lütfen sayfayı yenileyip tekrar giriş yapın.' };

    const rows = (input.rows || []).filter((r) => r.name && r.name.trim().length > 0);
    if (rows.length === 0) {
      return { error: 'Kaydedilecek satır yok — en az bir satır olmalı.' };
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('name, species, owner_name')
      .eq('id', patientId)
      .single();
    if (patientError || !patient) {
      return { error: 'Hasta bulunamadı: ' + (patientError?.message ?? 'bilinmeyen hata') };
    }

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

    const category = String(input.category || 'kan_tahlili').trim();
    const title = String(input.title || '').trim() || 'Dijitalleştirilmiş Belge';
    const takenAt = String(input.takenAt || '').trim() || null;

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://vetora-live.vercel.app').replace(/\/$/, '');
    const [logoPngBytes, fontRegularBytes, fontBoldBytes] = await Promise.all([
      fetch(`${appUrl}/logo-header.png`).then((r) => r.arrayBuffer()),
      fetch(`${appUrl}/fonts/DejaVuSans.ttf`).then((r) => r.arrayBuffer()),
      fetch(`${appUrl}/fonts/DejaVuSans-Bold.ttf`).then((r) => r.arrayBuffer()),
    ]);
    const pdfBytes = await buildLabResultPdf({
      patientName: patient.name,
      ownerName: patient.owner_name,
      species: patient.species,
      title,
      categoryLabel: CATEGORY_LABEL[category] ?? 'Diğer',
      takenAt,
      rows,
      logoPngBytes,
      fontRegularBytes,
      fontBoldBytes,
    });

    const safeName = title.replace(/[^a-zA-Z0-9._-]/g, '_') || 'belge';
    const path = `${patientId}/${Date.now()}-dijital-${safeName}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('lab-results')
      .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf' });
    if (uploadError) {
      return { error: 'PDF yüklenemedi: ' + uploadError.message };
    }

    const { error: insertError } = await supabase.from('lab_results').insert({
      patient_id: patientId,
      category,
      title: `${title} (Dijital)`,
      file_name: `${safeName}-dijital.pdf`,
      storage_path: path,
      taken_at: takenAt,
      uploaded_by: user.id,
      uploaded_by_name: profile?.full_name ?? 'Personel',
    });
    if (insertError) {
      return { error: 'Kayıt oluşturulamadı: ' + insertError.message };
    }

    revalidatePath(`/patients/${patientId}`);
    return { ok: true };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('saveDigitalLabResult failed', err);
    return { error: 'Beklenmeyen bir hata: ' + (err?.message ?? String(err)) };
  }
}
