// Next.js wraps {children} in the root layout with a Suspense boundary
// whenever a loading.tsx exists alongside it — this fires automatically on
// every route navigation under the app (dashboard, patient pages, admin,
// etc.) while the next page's data is being fetched on the server, which
// is the "uygulama içi geçişler için belirteç" (indicator for in-app
// transitions) the clinic asked for. Nothing to wire up per-page.
export default function Loading() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3">
      <div className="h-9 w-9 rounded-full border-[3px] border-border border-t-accent animate-spin" />
      <div className="text-xs font-semibold text-text3">Yükleniyor…</div>
    </div>
  );
}
