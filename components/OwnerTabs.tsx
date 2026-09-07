'use client';

import { useState } from 'react';

// Yatılı hasta sahibi görünümünde "Takip" (canlı olay akışı) ile
// "Laboratuvar" (yüklenen tahlil PDF'leri) arasında geçiş yapan basit bir
// sekme anahtarı. İkisi de zaten sunucuda render edilmiş olarak geliyor —
// burada sadece hangisi görünür, onu değiştiriyoruz (yeniden veri çekmiyor).
export function OwnerTabs({
  takip,
  lab,
  labCount,
}: {
  takip: React.ReactNode;
  lab: React.ReactNode;
  labCount: number;
}) {
  const [tab, setTab] = useState<'takip' | 'lab'>('takip');

  return (
    <div>
      <div className="flex gap-2 mb-4 no-print">
        <button
          type="button"
          onClick={() => setTab('takip')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
            tab === 'takip' ? 'bg-navy text-white' : 'bg-surface2 text-text2'
          }`}
        >
          Takip
        </button>
        <button
          type="button"
          onClick={() => setTab('lab')}
          className={`flex-1 rounded-lg px-3 py-2 text-sm font-bold transition-colors ${
            tab === 'lab' ? 'bg-navy text-white' : 'bg-surface2 text-text2'
          }`}
        >
          Laboratuvar{labCount > 0 ? ` (${labCount})` : ''}
        </button>
      </div>
      <div style={{ display: tab === 'takip' ? 'block' : 'none' }}>{takip}</div>
      <div style={{ display: tab === 'lab' ? 'block' : 'none' }}>{lab}</div>
    </div>
  );
}
