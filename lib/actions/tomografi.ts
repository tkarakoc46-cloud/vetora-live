'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import {
  extractDocxText,
  segmentTomografiReport,
  segmentTomografiFromPdf,
  type TomografiDraft,
} from '@/lib/tomografi';
import { buildTomografiPdf } from '@/lib/pdfTomografi';

// Adım 1: personel bir tomografi raporunun (.docx VEYA .pdf) yanındaki
// "📐 Şablona Uygula" butonuna bastığında çağrılır. Belgeyi Storage'dan
// indirir, içeriğini Gemini ile başlık/bulgular/sonuç olarak üçe ayırır.
// HİÇBİR ŞEY KAYDETMEZ — personel önce ekranda gördüğü taslağı gözden
// geçirip (gerekirse düzeltip) "Onayla ve PDF Oluştur" demeli (bkz.
// components/TomografiReviewPanel.tsx) — tıpkı kan tahlili "Dijitalleştir"
// adımındaki gibi.
export async function extractTomografiReport(
  labResultId: string
): Promise<{ draft: TomografiDraft } | { error: string }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Oturumunuz sona ermiş görünüyor. Lütfen sayfayı yenileyip tekrar giriş yapın.' };

    const { data: labResult, error: fetchError } = await supabase
      .from('lab_results')
      .select('storage_path, file_name')
      .eq('id', labResultId)
      .single();
    if (fetchError || !labResult) {
      return { error: 'Belge bulunamadı: ' + (fetchError?.message ?? 'bilinmeyen hata') };
    }

    const nameLower = (labResult.file_name || '').toLowerCase();
    const isDocx = nameLower.endsWith('.docx');
    const isPdf = nameLower.endsWith('.pdf');
    if (!isDocx && !isPdf) {
      return { error: 'Şablona uygulama sadece Word (.docx) veya PDF dosyaları için çalışır.' };
    }

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('lab-results')
      .download(labResult.storage_path);
    if (downloadError || !fileData) {
      return { error: 'Belge indirilemedi: ' + (downloadError?.message ?? 'bilinmeyen hata') };
    }

    const bytes = Buffer.from(await fileData.arrayBuffer());

    let draft: TomografiDraft;
    if (isDocx) {
      const rawText = await extractDocxText(bytes);
      if (!rawText) {
        return { error: 'Word dosyasından metin okunamadı. Dosyanın bozuk olmadığından emin olun.' };
      }
      draft = await segmentTomografiReport(rawText);
    } else {
      // PDF: metin çıkarma adımı yok — Gemini'ye doğrudan gönderiyoruz,
      // hem düz metinli hem taranmış/fotoğraflanmış PDF'lerde çalışır.
      draft = await segmentTomografiFromPdf(bytes);
    }
    if (draft.findings.length === 0 && draft.sonucLines.length === 0) {
      return {
        error:
          'Belgede tanınabilir bir rapor metni bulunamadı. Dosyanın gerçekten bir tomografi raporu metni içerdiğinden emin olun ve tekrar deneyin.',
      };
    }
    return { draft };
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('extractTomografiReport failed', err);
    if (err?.message === 'GEMINI_API_KEY_MISSING') {
      return {
        error:
          'Bu özellik için gereken Gemini API anahtarı sisteme henüz eklenmemiş. Lütfen sistem yöneticinizle iletişime geçin.',
      };
    }
    if (err?.message === 'GEMINI_API_KEY_INVALID') {
      return { error: 'Gemini API anahtarı geçersiz görünüyor. Lütfen sistem ayarlarını kontrol edin.' };
    }
    if (err?.message === 'GEMINI_QUOTA_EXCEEDED') {
      return { error: 'Şu anda kullanım sınırına ulaşıldı. Lütfen birkaç dakika sonra tekrar deneyin.' };
    }
    if (typeof err?.message === 'string' && /^GEMINI_HTTP_(500|502|503|504)$/.test(err.message)) {
      return {
        error: 'Google’un yapay zeka servisi şu anda çok yoğun/geçici olarak erişilemez durumda. Lütfen birkaç saniye bekleyip tekrar deneyin.',
      };
    }
    if (err?.name === 'AbortError') {
      return { error: 'Sunucudan zamanında yanıt alınamadı. Lütfen tekrar deneyin.' };
    }
    return { error: 'Metin ayrıştırma başarısız oldu: ' + (err?.message ?? String(err)) };
  }
}

// Adım 2: personel taslağı onayladıktan sonra çağrılır. Trakya Hayvan
// Hastanesi logolu/şablonlu bir PDF üretir, arşive yükler ve lab_results
// tablosuna YENİ bir satır ekler — orijinal .docx silinmez, ikisi de
// arşivde kalır (kan tahlili dijitalleştirme özelliğiyle aynı prensip).
export async function saveTomografiReport(
  patientId: string,
  input: { examTitle: string; findings: string[]; sonucLines: string[]; title: string; takenAt: string }
): Promise<{ error: string } | { ok: true }> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: 'Oturumunuz sona ermiş görünüyor. Lütfen sayfayı yenileyip tekrar giriş yapın.' };

    const findings = (input.findings || []).map((s) => String(s || '').trim()).filter(Boolean);
    const sonucLines = (input.sonucLines || []).map((s) => String(s || '').trim()).filter(Boolean);
    if (findings.length === 0 && sonucLines.length === 0) {
      return { error: 'Kaydedilecek bir bulgu/sonuç metni yok.' };
    }

    const { data: patient, error: patientError } = await supabase
      .from('patients')
      .select('name, owner_name')
      .eq('id', patientId)
      .single();
    if (patientError || !patient) {
      return { error: 'Hasta bulunamadı: ' + (patientError?.message ?? 'bilinmeyen hata') };
    }

    const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', user.id).single();

    const title = String(input.title || '').trim() || 'Tomografi Raporu';
    const takenAt = String(input.takenAt || '').trim() || null;
    const examTitle = String(input.examTitle || '').trim();

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://vetora-live.vercel.app').replace(/\/$/, '');
    const [headerImageBytes, fontRegularBytes, fontBoldBytes] = await Promise.all([
      fetch(`${appUrl}/brand/trakya-bt-header.jpg`).then((r) => r.arrayBuffer()),
      fetch(`${appUrl}/fonts/Baloo2-Regular.ttf`).then((r) => r.arrayBuffer()),
      fetch(`${appUrl}/fonts/Baloo2-ExtraBold.ttf`).then((r) => r.arrayBuffer()),
    ]);

    const pdfBytes = await buildTomografiPdf({
      ownerName: patient.owner_name,
      petName: patient.name,
      reportDate: takenAt,
      examTitle,
      findings,
      sonucLines,
      headerImageBytes,
      fontRegularBytes,
      fontBoldBytes,
    });

    const safeName = title.replace(/[^a-zA-Z0-9._-]/g, '_') || 'bt-raporu';
    const path = `${patientId}/${Date.now()}-tomografi-${safeName}.pdf`;

    const { error: uploadError } = await supabase.storage
      .from('lab-results')
      .upload(path, Buffer.from(pdfBytes), { contentType: 'application/pdf' });
    if (uploadError) {
      return { error: 'PDF yüklenemedi: ' + uploadError.message };
    }

    const { error: insertError } = await supabase.from('lab_results').insert({
      patient_id: patientId,
      category: 'tomografi',
      title: `${title} (Şablon)`,
      file_name: `${safeName}-sablon.pdf`,
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
    console.error('saveTomografiReport failed', err);
    return { error: 'Beklenmeyen bir hata: ' + (err?.message ?? String(err)) };
  }
}
