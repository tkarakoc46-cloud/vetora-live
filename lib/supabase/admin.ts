import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// SERVER-ONLY. Uses the service-role key, which bypasses Row Level
// Security entirely. Import this ONLY from server-side code that never
// ships to the browser (Route Handlers under app/api/**, Server Actions) —
// e.g. the owner-link routes, which must look up a patient by access_token
// without the requester ever having a Supabase Auth session, and the
// WhatsApp webhook, which runs with no user session at all.
//
// Never import this file from a 'use client' component or a Client
// Component — Next.js will refuse to bundle it into client code as long
// as it's only referenced from server files, but double-check any new
// route you add here.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}
