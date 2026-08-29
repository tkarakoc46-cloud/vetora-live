'use client';

import { useEffect, useState } from 'react';

type RecordRow = {
  id: string;
  type: string;
  payload: any;
  created_at: string;
  signedUrl?: string;
};

const STATUS_LABEL: Record<string, string> = {
  stable: 'Stabil',
  improving: 'İyiye Gidiyor',
  watch: 'Yakın Takip',
  critical: 'Kritik',
};
const STATUS_COLOR: Record<string, string> = {
  stable: 'bg-green-50 text-green',
  improving: 'bg-accentSoft text-accent',
  watch: 'bg-amber-50 text-amber',
  critical: 'bg-red-50 text-red',
};

const EVENT_ICON: Record<string, string> = {
  surgery_start: '🔪',
  surgery_end: '✅',
  anesthesia_start: '💤',
  anesthesia_end: '👁️',
  status_change: 'ℹ️',
  discharged: '🏠',
  xray: '🩻',
  blood_drawn: '🩸',
  blood_results: '🧪',
  serum: '💧',
  injection: '💉',
  deceased: '🕊️',
};

function formatIstanbul(iso: string) {
  // Always Turkey time, regardless of the owner's own device/timezone
  // setting — this was one of the explicit asks: "güncel Türkiye saati ile".
  return new Date(iso).toLocaleString('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function recordDetail(r: RecordRow): string {
  const p = r.payload || {};
  switch (r.type) {
    case 'vital':
      return `Isı ${p.temp_c ?? '—'}°C · Nabız ${p.pulse_bpm ?? '—'}/dk · Solunum ${p.resp_rpm ?? '—'}/dk${p.note ? ' · ' + p.note : ''}`;
    case 'surgery':
      return `${p.procedure || '—'}${p.surgeon ? ' · Cerrah: ' + p.surgeon : ''}${p.anesthesia ? ' · Anestezi: ' + p.anesthesia : ''}${p.outcome ? ' · Sonuç: ' + p.outcome : ''}${p.postop_note ? ' · ' + p.postop_note : ''}`;
    case 'event':
      return p.label + (p.note ? ' · ' + p.note : '');
    case 'note':
      return p.text || '';
    case 'photo':
      return p.caption || 'Fotoğraf eklendi';
    default:
      return p.text || p.caption || p.label || '';
  }
}

// Polls the token-gated /api/owner/[token]/records route every 5s and
// re-renders both the status badge and the journal in place. This is what
// makes "hasta sahibinin anlık görebilmesi" (the owner seeing a status
// change, a new photo, or a "ameliyata alındı" event instantly) real
// rather than "the next time they happen to reload the page".
export function OwnerLiveFeed({
  token,
  initialRecords,
  initialStatus,
}: {
  token: string;
  initialRecords: RecordRow[];
  initialStatus: string;
}) {
  const [records, setRecords] = useState(initialRecords);
  const [status, setStatus] = useState(initialStatus);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/owner/${token}/records`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const fresh: RecordRow[] = data.records ?? [];
        setRecords((prev) => {
          if (fresh.length && fresh[0]?.id !== prev[0]?.id) {
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 2500);
          }
          return fresh;
        });
        if (data.patient?.status) setStatus(data.patient.status);
      } catch {
        // network hiccup — just try again on the next tick
      }
    };
    const interval = setInterval(poll, 5000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [token]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-text3 uppercase">Güncel Durum</div>
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${STATUS_COLOR[status] ?? ''}`}>
          {STATUS_LABEL[status] ?? status}
        </span>
      </div>

      {justUpdated && (
        <div className="text-xs font-semibold text-green bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ Yeni bir kayıt eklendi
        </div>
      )}
      <div className="card divide-y divide-border mb-6">
        {records.map((r) => (
          <div key={r.id} className="p-3.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">
                {r.type === 'event' && EVENT_ICON[r.payload?.event] ? EVENT_ICON[r.payload.event] + ' ' : ''}
                {r.type === 'photo' ? '📷 Fotoğraf' : r.type === 'surgery' ? '🔪 Ameliyat' : r.type === 'vital' ? '🩺 Vital Bulgu' : r.type === 'event' ? '' : r.type === 'note' ? '📝 Not' : r.type}
              </span>
              <span className="text-xs text-text3 mono">{formatIstanbul(r.created_at)}</span>
            </div>
            {r.type === 'photo' && r.signedUrl && (
              <a
                href={r.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block my-2"
              >
                <img
                  src={r.signedUrl}
                  alt={r.payload.caption || 'Fotoğraf'}
                  className="rounded-xl max-h-72 object-cover w-full"
                />
                <div className="text-[11px] text-accent font-semibold mt-1">Büyütmek / indirmek için dokunun ↗</div>
              </a>
            )}
            <div className="text-sm mt-1">{recordDetail(r)}</div>
          </div>
        ))}
        {records.length === 0 && <div className="p-6 text-center text-sm text-text3">Henüz kayıt yok.</div>}
      </div>
    </div>
  );
}
