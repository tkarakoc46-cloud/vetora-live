'use client';

import { useEffect, useState } from 'react';

type RecordRow = {
  id: string;
  type: string;
  payload: any;
  created_at: string;
  signedUrl?: string;
};

// Polls the token-gated /api/owner/[token]/records route every 5s and
// re-renders the journal in place. This is what makes "hasta sahibinin
// anlık görebilmesi" (the owner seeing a new photo/entry instantly) real
// rather than "the next time they happen to reload the page" — a staff
// upload typically appears here within 5 seconds, with no manual refresh.
export function OwnerLiveFeed({ token, initialRecords }: { token: string; initialRecords: RecordRow[] }) {
  const [records, setRecords] = useState(initialRecords);
  const [justUpdated, setJustUpdated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/api/owner/${token}/records`, { cache: 'no-store' });
        if (!res.ok || cancelled) return;
        const { records: fresh } = await res.json();
        setRecords((prev) => {
          if (fresh.length && fresh[0]?.id !== prev[0]?.id) {
            setJustUpdated(true);
            setTimeout(() => setJustUpdated(false), 2500);
          }
          return fresh;
        });
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
      {justUpdated && (
        <div className="text-xs font-semibold text-green bg-green-50 rounded-lg px-3 py-2 mb-2">
          ✓ Yeni bir kayıt eklendi
        </div>
      )}
      <div className="card divide-y divide-border mb-6">
        {records.map((r) => (
          <div key={r.id} className="p-3.5">
            <div className="text-xs text-text3 mono mb-1">{new Date(r.created_at).toLocaleString('tr-TR')}</div>
            {r.type === 'photo' && r.signedUrl && (
              <img
                src={r.signedUrl}
                alt={r.payload.caption || 'Fotoğraf'}
                className="rounded-xl mb-2 max-h-72 object-cover"
              />
            )}
            <div className="text-sm">{r.payload.caption || r.payload.text || r.payload.procedure || ''}</div>
          </div>
        ))}
        {records.length === 0 && <div className="p-6 text-center text-sm text-text3">Henüz kayıt yok.</div>}
      </div>
    </div>
  );
}
