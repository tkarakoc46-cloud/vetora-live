'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { extractTomografiReport, saveTomografiReport } from '@/lib/actions/tomografi';

// e-Klinik'te bir tomografi (.docx) belgesinin yanındaki "📐 Şablona Uygula"
// butonu ve onun açtığı gözden-geçir-ve-onayla paneli. Word dosyasındaki
// düz metin okunup başlık/bulgular/sonuç olarak ayrılıyor, ama HİÇBİR ŞEY
// otomatik olarak kalıcı kayda yazılmıyor — personel önce metni kontrol
// edip (gerekirse düzelttikten) sonra "Onayla ve PDF Oluştur" demeli.
// Bu, yapay zekânın yanlış ayırdığı bir cümlenin sessizce Trakya Hayvan
// Hastanesi logolu resmi rapora geçmesini engelleyen bilinçli bir adım.
export function TomografiTemplateButton({
  patientId,
  labResultId,
  defaultTitle,
  defaultTakenAt,
}: {
  patientId: string;
  labResultId: string;
  defaultTitle: string;
  defaultTakenAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  const [loaded, setLoaded] = useState(false);
  const [title, setTitle] = useState(defaultTitle);
  const [examTitle, setExamTitle] = useState('');
  const [findingsText, setFindingsText] = useState('');
  const [sonucText, setSonucText] = useState('');

  async function handleOpen() {
    setOpen(true);
    if (loaded || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await extractTomografiReport(labResultId);
      if (!result || typeof result !== 'object') {
        setError('Sunucudan geçerli bir yanıt alınamadı. Lütfen tekrar deneyin; devam ederse bana bildirin.');
      } else if ('error' in result) {
        setError(result.error);
      } else {
        setExamTitle(result.draft.examTitle);
        setFindingsText(result.draft.findings.join('\n\n'));
        setSonucText(result.draft.sonucLines.join('\n'));
        setLoaded(true);
      }
    } catch (err: any) {
      setError('Beklenmeyen bir hata oluştu: ' + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const findings = findingsText
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      const sonucLines = sonucText
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await saveTomografiReport(patientId, {
        examTitle,
        findings,
        sonucLines,
        title,
        takenAt: defaultTakenAt || '',
      });
      if (!result || typeof result !== 'object') {
        setError('Sunucudan geçerli bir yanıt alınamadı. Lütfen tekrar deneyin; devam ederse bana bildirin.');
        return;
      }
      if ('error' in result) {
        setError(result.error);
        return;
      }
      setSuccess(true);
      router.refresh();
      setTimeout(() => {
        setOpen(false);
        setSuccess(false);
        setLoaded(false);
      }, 1500);
    } catch (err: any) {
      setError('Beklenmeyen bir hata oluştu: ' + (err?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={handleOpen}
        title="Şablona Uygula"
        aria-label="Şablona Uygula"
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-surface2 text-base leading-none"
      >
        📐
      </button>
    );
  }

  return (
    <div className="w-full mt-3 p-3 rounded-lg border border-border bg-surface2 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-bold text-text">Tomografi Raporu — Şablona Uygula, Gözden Geçir</div>
        <button type="button" onClick={() => setOpen(false)} className="text-text3 font-semibold">
          Kapat
        </button>
      </div>

      {loading && <div className="text-text2">Word belgesi okunuyor, birkaç saniye sürebilir…</div>}

      {error && (
        <div className="text-red font-semibold bg-red-50 border border-red/30 rounded-lg px-3 py-2">⚠️ {error}</div>
      )}

      {success && (
        <div className="text-green font-semibold bg-green-50 border border-green/30 rounded-lg px-3 py-2">
          ✓ Trakya Hayvan Hastanesi şablonlu PDF oluşturuldu ve arşive eklendi.
        </div>
      )}

      {loaded && !success && (
        <>
          <div className="text-text3">
            Aşağıdaki metin belgeden otomatik ayrıldı. Kaydetmeden önce kontrol edin — gerekirse düzeltin.
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Başlık (örn: Kranial BT)"
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
          />

          <label className="block text-text3 font-semibold">İnceleme Türü (ör. KRANİAL BT)</label>
          <input
            value={examTitle}
            onChange={(e) => setExamTitle(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
          />

          <label className="block text-text3 font-semibold">Bulgular (paragraflar arasına boş satır bırakın)</label>
          <textarea
            value={findingsText}
            onChange={(e) => setFindingsText(e.target.value)}
            rows={6}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
          />

          <label className="block text-text3 font-semibold">Sonuç (her satır ayrı bir madde olur)</label>
          <textarea
            value={sonucText}
            onChange={(e) => setSonucText(e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
          />

          <div className="flex items-center justify-end pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="btn-primary px-4 py-1.5 disabled:opacity-60 disabled:cursor-wait"
            >
              {saving ? 'Kaydediliyor…' : 'Onayla ve PDF Oluştur'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
