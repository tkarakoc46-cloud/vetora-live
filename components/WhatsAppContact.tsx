'use client';

import { useState } from 'react';

// The Meta WhatsApp Cloud API (silent server-side forwarding) needs a
// verified Meta Business account, a permanent access token and — for
// messages outside the 24h session window — an approved message template.
// None of that is set up yet, so the in-app "send" box was quietly going
// nowhere. This is the reliable alternative that works with zero setup:
// a wa.me deep link opens WhatsApp itself (app or web) in a chat with the
// clinic's real number, message pre-filled — the owner just taps Send
// inside WhatsApp. It lands in the clinic's actual WhatsApp, guaranteed.
export function WhatsAppContact({
  hospitalNumber,
  patientName,
}: {
  hospitalNumber: string;
  patientName: string;
}) {
  const [message, setMessage] = useState(
    `Merhaba, ${patientName} isimli hastamla ilgili bilgi almak istiyorum.`
  );
  const href = `https://wa.me/${hospitalNumber}?text=${encodeURIComponent(message)}`;

  return (
    <div className="card p-4 mb-6 no-print">
      <div className="font-bold text-sm mb-2">Hastaneye Mesaj Gönder</div>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm mb-3"
      />
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="btn-primary w-full inline-flex items-center justify-center gap-2"
      >
        📱 WhatsApp'ta Aç ve Gönder
      </a>
      <div className="text-[11px] text-text3 mt-2">
        Bu düğme doğrudan hastanenin WhatsApp hattını açar, mesajınız hazır şekilde gelir — WhatsApp açıldığında sadece "Gönder"e basmanız yeterli.
      </div>
    </div>
  );
}
