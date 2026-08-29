'use client';

import { useState } from 'react';
import { useFormStatus } from 'react-dom';

// Always defaults the time-of-death field to "right now in Turkey time",
// regardless of the staff device's own clock/timezone setting — same rule
// the rest of the app follows for anything shown as a timestamp. Staff can
// still edit it back if they're logging the death a few minutes after it
// happened.
function nowIstanbulLocalInputValue() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

function DeceasedSubmit({ canSubmit }: { canSubmit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={!canSubmit || pending}
      className="btn-danger w-full disabled:opacity-40 disabled:cursor-not-allowed"
    >
      {pending ? 'Kaydediliyor…' : 'Hasta EX Oldu'}
    </button>
  );
}

// Recording a death is the single highest-stakes button in the app — worse
// to mis-tap than discharge or even delete, since it can't be quietly
// walked back once staff or the owner have seen it. Uses the same "type the
// patient's name to confirm" gate as the delete form, plus a required,
// editable time-of-death field.
export function DeceasedForm({
  action,
  patientName,
}: {
  action: (formData: FormData) => void;
  patientName: string;
}) {
  const [confirmText, setConfirmText] = useState('');
  const [deathTime] = useState(nowIstanbulLocalInputValue);
  const canSubmit = confirmText.trim() === patientName;

  return (
    <form action={action} className="field space-y-2">
      <label>
        Ölüm tarihi ve saati
        <input type="datetime-local" name="death_time" defaultValue={deathTime} required />
      </label>
      <label>
        Not (opsiyonel)
        <textarea name="note" rows={2} placeholder="Ör. neden, ilgilenen hekim…" />
      </label>
      <label>
        Onaylamak için hastanın adını yazın: <span className="font-bold text-text">{patientName}</span>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder={patientName}
        />
      </label>
      <DeceasedSubmit canSubmit={canSubmit} />
    </form>
  );
}
