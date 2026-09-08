'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { createPhotoUploadTicket, finalizePhotoRecord } from '@/lib/actions/records';

// Fotoğraf yükleme de aynı sebeple (Vercel'in Server Action'lar için
// uyguladığı ~4.5MB'lık platform sınırı) doğrudan tarayıcıdan Supabase
// Storage'a yapılıyor — ayrıntı için lib/actions/records.ts.
export function PhotoUploadForm({ patientId }: { patientId: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [caption, setCaption] = useState('');
  const [busy, setBusy] = useState(false);
  const [statusText, setStatusText] = useState('Kaydet');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const file = fileInputRef.current?.files?.[0];
    if (!file) {
      setError('Fotoğraf seçilmedi.');
      return;
    }

    setBusy(true);
    try {
      setStatusText('Hazırlanıyor…');
      const ticket = await createPhotoUploadTicket(patientId, file.name, file.type, file.size);
      if ('error' in ticket) {
        setError(ticket.error);
        return;
      }

      setStatusText('Yükleniyor…');
      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from('patient-photos')
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || 'image/jpeg',
        });
      if (uploadError) {
        setError('Dosya yüklenemedi: ' + uploadError.message);
        return;
      }

      setStatusText('Kaydediliyor…');
      const result = await finalizePhotoRecord(patientId, {
        storagePath: ticket.path,
        caption,
        visibleToOwner: true,
      });
      if ('error' in result) {
        setError(result.error);
        return;
      }

      setCaption('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      router.refresh();
    } catch (err: any) {
      setError('Beklenmeyen bir hata oluştu: ' + (err?.message ?? String(err)));
    } finally {
      setBusy(false);
      setStatusText('Kaydet');
    }
  }

  return (
    <form onSubmit={handleSubmit} className="field card p-4 space-y-2">
      <div className="font-bold text-sm mb-1">Fotoğraf Ekle</div>
      <input ref={fileInputRef} name="photo" type="file" accept="image/*" capture="environment" required />
      <input name="caption" placeholder="Açıklama (opsiyonel)" value={caption} onChange={(e) => setCaption(e.target.value)} />
      {error && <div className="text-xs text-red font-semibold">{error}</div>}
      <button type="submit" disabled={busy} className="btn-primary w-full disabled:opacity-60 disabled:cursor-wait">
        {busy ? statusText : 'Kaydet'}
      </button>
    </form>
  );
}
