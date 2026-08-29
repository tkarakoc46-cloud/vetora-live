'use client';

import { useFormStatus } from 'react-dom';

// A visible "belirteç" (indicator) for the single most common in-app
// transition: tapping a button that submits a Server Action. Without this,
// a slow connection on a clinic phone makes a tap look like it did
// nothing, and staff tap again (duplicate records). useFormStatus reads
// the nearest parent <form>'s pending state, so this just has to render
// inside the <form> it belongs to.
export function SubmitButton({
  children,
  pendingText = 'Kaydediliyor…',
  className = 'btn-primary w-full',
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${className} disabled:opacity-60 disabled:cursor-wait`}>
      {pending ? pendingText : children}
    </button>
  );
}
