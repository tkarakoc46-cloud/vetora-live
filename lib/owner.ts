import { createAdminClient } from '@/lib/supabase/admin';

// The single chokepoint every owner-facing route goes through. Looks up
// a patient by its secret access_token using the service-role client —
// deliberately NOT via a Supabase Auth session, because owners never get
// one. If the token doesn't match an active patient, callers must treat
// it exactly like "not found" (see app/p/[token]/page.tsx) so a guess or
// a leaked/expired link reveals nothing.
export async function getPatientByToken(token: string) {
  const supabase = createAdminClient();
  const { data: patient } = await supabase
    .from('patients')
    .select('*')
    .eq('access_token', token)
    .eq('access_token_active', true)
    .single();
  return patient ?? null;
}
