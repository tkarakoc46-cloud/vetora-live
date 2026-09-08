'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { extractLabResultTable, saveDigitalLabResult } from '@/lib/actions/ocr';
import type { LabRow } from '@/lib/ocr';

// e-Klinik'te bir fotoğraf/tarama belgesinin yanındaki "🔎 Dijitalleştir"
// butonu ve onun açtığı gözden-geçir-ve-onayla paneli. Belgedeki yazı OCR
// ile okunup satırlara ayrılıyor, ama HİÇBİR ŞEY otomatik olarak hastanın
// kalıcı kaydına yazılmıyor — personel önce ekranda gördüğü tabloyu kontrol
// edip (gerekirse hücreleri elle düzeltip) "Onayla ve PDF Oluştur" demeli.
// Bu, OCR'ın yanlış okuduğu bir değerin sessizce kayda geçmesini engelleyen
// bilinçli bir güvenlik adımı.
export function LabResultDigitizeButton({
  patientId,
  labResultId,
  defaultTitle,
  defaultCategory,
  defaultTakenAt,
}: {
  patientId: string;
  labResultId: string;
  defaultTitle: string;
  defaultCategory: string;
  defaultTakenAt: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<LabRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [title, setTitle] = useState(defaultTitle);

  async function handleOpen() {
    setOpen(true);
    if (rows || loading) return;
    setError(null);
    setLoading(true);
    try {
      const result = await extractLabResultTable(labResultId);
      if (!result || typeof result !== 'object') {
        setError('Sunucudan geçerli bir yanıt alınamadı. Lütfen tekrar deneyin; devam ederse bana bildirin.');
      } else if ('error' in result) {
        setError(result.error);
      } else {
        setRows(result.rows);
      }
    } catch (err: any) {
      setError('Beklenmeyen bir hata oluştu: ' + (err?.message ?? String(err)));
    } finally {
      setLoading(false);
    }
  }

  function updateRow(idx: number, field: keyof LabRow, value: string) {
    setRows((prev) => {
      if (!prev) return prev;
      const next = prev.slice();
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }

  function removeRow(idx: number) {
    setRows((prev) => (prev ? prev.filter((_, i) => i !== idx) : prev));
  }

  function addRow() {
    setRows((prev) => [...(prev ?? []), { name: '', result: '', range: '', unit: '' }]);
  }

  async function handleSave() {
    if (!rows) return;
    setSaving(true);
    setError(null);
    try {
      const result = await saveDigitalLabResult(patientId, {
        rows,
        title,
        category: defaultCategory,
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
        setRows(null);
      }, 1500);
    } catch (err: any) {
      setError('Beklenmeyen bir hata oluştu: ' + (err?.message ?? String(err)));
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button type="button" onClick={handleOpen} className="text-xs text-accent font-semibold ml-1 whitespace-nowrap">
        🔎 Dijitalleştir
      </button>
    );
  }

  return (
    <div className="w-full mt-3 p-3 rounded-lg border border-border bg-surface2 text-xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="font-bold text-text">Belgeyi Dijitalleştir — Gözden Geçir</div>
        <button type="button" onClick={() => setOpen(false)} className="text-text3 font-semibold">
          Kapat
        </button>
      </div>

      {loading && <div className="text-text2">Belge okunuyor, birkaç saniye sürebilir…</div>}

      {error && (
        <div className="text-red font-semibold bg-red-50 border border-red/30 rounded-lg px-3 py-2">⚠️ {error}</div>
      )}

      {success && (
        <div className="text-green font-semibold bg-green-50 border border-green/30 rounded-lg px-3 py-2">
          ✓ Dijital PDF oluşturuldu ve arşive eklendi.
        </div>
      )}

      {rows && !success && (
        <>
          <div className="text-text3">
            Aşağıdaki satırlar belgeden otomatik okundu. Kaydetmeden önce mutlaka kontrol edin — yanlış okunan bir hücreye
            dokunup düzeltebilir, gereksiz satırları silebilir veya eksik satır ekleyebilirsiniz.
          </div>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Başlık"
            className="w-full rounded-lg border border-border bg-surface px-2 py-1.5"
          />

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-text3">
                  <th className="pb-1 pr-1">Test Adı</th>
                  <th className="pb-1 pr-1">Sonuç</th>
                  <th className="pb-1 pr-1">Referans Aralığı</th>
                  <th className="pb-1 pr-1">Birim</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="py-0.5 pr-1">
                      <input
                        value={row.name}
                        onChange={(e) => updateRow(idx, 'name', e.target.value)}
                        className="w-full rounded border border-border bg-surface px-1.5 py-1"
                      />
                    </td>
                    <td className="py-0.5 pr-1">
                      <input
                        value={row.result}
                        onChange={(e) => updateRow(idx, 'result', e.target.value)}
                        className="w-20 rounded border border-border bg-surface px-1.5 py-1"
                      />
                    </td>
                    <td className="py-0.5 pr-1">
                      <input
                        value={row.range}
                        onChange={(e) => updateRow(idx, 'range', e.target.value)}
                        className="w-24 rounded border border-border bg-surface px-1.5 py-1"
                      />
                    </td>
                    <td className="py-0.5 pr-1">
                      <input
                        value={row.unit}
                        onChange={(e) => updateRow(idx, 'unit', e.target.value)}
                        className="w-16 rounded border border-border bg-surface px-1.5 py-1"
                      />
                    </td>
                    <td className="py-0.5">
                      <button type="button" onClick={() => removeRow(idx)} className="text-red font-semibold px-1">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button type="button" onClick={addRow} className="text-accent font-semibold">
              + Satır Ekle
            </button>
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
