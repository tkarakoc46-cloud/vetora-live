'use client';

import { useState } from 'react';

// The server action (lib/actions/patients.ts#deletePatient) is the real
// security boundary — it independently re-checks the caller's role before
// deleting anything. This client-side "type the patient's name to confirm"
// gate exists only to stop an accidental tap on an irreversible button; it
// is a safety net, not the access control.
export function DeletePatientForm({
  action,
  patientName,
}: {
  action: (formData: FormData) => void;
  patientName: string;
}) {
  const [confirmText, setConfirmText] = useState('');
  const canDelete = confirmText.trim() === patientName;

  return (
    <form action={action} className="space-y-2">
      <label className="block text-xs font-semibold text-text2">
        Onaylamak için hastanın adını yazın: <span className="font-bold">{patientName}</span>
      </label>
      <input
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        placeholder={patientName}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
      />
      <button type="submit" disabled={!canDelete} className="btn-danger w-full disabled:opacity-40 disabled:cursor-not-allowed">
        Hastayı ve Tüm Verilerini Kalıcı Olarak Sil
      </button>
    </form>
  );
}
