'use client';

import { useState } from 'react';

export function CopyButton({ text, label = '📋 Bağlantıyı Kopyala' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard API blocked (older browser / non-HTTPS context) — the
          // link is still selectable/readable right next to this button.
        }
      }}
      className="btn-outline text-xs"
    >
      {copied ? '✓ Kopyalandı' : label}
    </button>
  );
}
