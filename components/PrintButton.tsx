'use client';

// The whole "PDF rapor" feature is just the browser's native print dialog:
// everything with class `no-print` (forms, buttons, nav) is hidden via the
// @media print rules in globals.css, so what's left — patient header +
// full timeline — prints cleanly, and "Save as PDF" in the print dialog is
// how staff or an owner turns it into an actual PDF file. No server-side
// PDF library, no extra route to keep in sync with the live timeline.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn-outline text-xs"
    >
      🖨️ Raporu Yazdır / PDF Kaydet
    </button>
  );
}
