'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createLabResultUploadTicket, finalizeLabResult } from '@/lib/actions/labResults';

const CATEGORIES = [
  { value: 'kan_tahlili', label: '🩸 Kan Tahlili' },
  { value: 'tomografi', label: '🧲 Tomografi' },
  { value: 'rontgen', label: '🩻 Röntgen' },
  { value: 'diger', label: '📄 Diğer' },
];

// e-Klinik dosyaları artık bu bileşenden, doğrudan tarayıcıdan Supabase
// Storage'a yükleniyor (Vercel'in Server Action'lar için uyguladığı
// ~4.5MB'lık platform sınırını atlamak için) — ayrıntılı açıklama
// lib/actions/labResults.ts dosyasının başında.
export function LabResultUploadForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState('kan_tahlili');
  const [title, setTitle] = useState('');
  const [takenAt, setTakenAt] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('Belgeyi Yükle');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Yüklenecek dosya seçilmedi.');
      return;
    }

    setBusy(true);
    try {
      setStatusText('Hazırlanıyor…');
      const ticket = await createLabResultUploadTicket(patientId, file.name, file.type, file.size);
      if ('error' in ticket) {
        setError(ticket.error);
        return;
      }

      setStatusText('Yükleniyor…');
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('lab-results')
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || 'application/octet-stream',
        });
      if (uploadError) {
        setError('Dosya yüklenemedi: ' + uploadError.message);
        return;
      }

      setStatusText('Kaydediliyor…');
      const result = await finalizeLabResult(patientId, {
        storagePath: ticket.path,
        fileName: file.name,
        category,
        title,
        takenAt,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }

      setTitle('');
      setTakenAt('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (err: any) {
      setError('Beklenmeyen bir hata oluştu: ' + (err?.message ?? String(err)));
    } finally {
      setBusy(false);
      setStatusText('Belgeyi Yükle');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="field space-y-2 mb-3">
      <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} required>
        {CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      <input
        ref={fileInputRef}
        name="file"
        type="file"
        accept="application/pdf,.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp"
        required
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="title"
          placeholder="Başlık (örn: Tam Kan Sayımı)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <input name="taken_at" type="date" value={takenAt} onChange={(e) => setTakenAt(e.target.value)} />
      </div>
      {error && <div className="text-xs text-red font-semibold">{error}</div>}
      <button
        type="submit"
        disabled={busy}
        className="btn-primary w-full disabled:opacity-60 disabled:cursor-wait"
      >
        {busy ? statusText : 'Belgeyi Yükle'}
      </button>
    </form>
  );
}
