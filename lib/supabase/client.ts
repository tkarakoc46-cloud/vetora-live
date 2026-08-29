'use client';

import { createBrowserClient } from '@supabase/ssr';

// Used inside Client Components. Only ever carries the public anon key —
// safe to ship to the browser. RLS (see supabase/schema.sql) is what
// actually keeps a signed-in staff/admin session scoped to what it's
// allowed to see; this key alone grants nothing.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
