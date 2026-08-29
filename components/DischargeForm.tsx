'use client';

import { useFormStatus } from 'react-dom';

function DischargeSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-outline w-full disabled:opacity-60 disabled:cursor-wait">
      {pending ? 'Taburcu ediliyor…' : '🏠 Hastayı Taburcu Et'}
    </button>
  );
}

// Discharge is a routine, non-destructive daily action (unlike the
// admin-only delete below it) — any staff member can do it, records stay
// intact, and it only moves the patient into the "Taburcu Edilmiş" list. A
// plain native confirm() is enough friction to stop an accidental tap
// without slowing staff down the way the delete form's type-to-confirm does.
export function DischargeForm({
  action,
  patientName,
}: {
  action: (formData: FormData) => void;
  patientName: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(`${patientName} taburcu edilsin mi?`)) {
          e.preventDefault();
        }
      }}
    >
      <DischargeSubmit />
    </form>
  );
}
