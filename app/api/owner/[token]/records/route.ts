import { NextRequest, NextResponse } from 'next/server';
import { getPatientByToken } from '@/lib/owner';
import { createAdminClient } from '@/lib/supabase/admin';

// Polled by the owner page's live-feed client component (see
// components/OwnerLiveFeed.tsx) so a photo or note a staff member adds
// shows up in the owner's browser within a few seconds — no page reload,
// and still entirely gated by the same secret token as the page itself
// (never a direct database/Realtime connection from the owner's browser).
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const patient = await getPatientByToken(params.token);
  if (!patient) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const supabase = createAdminClient();
  const { data: records } = await supabase
    .from('records')
    .select('*')
    .eq('patient_id', patient.id)
    .eq('visible_to_owner', true)
    .order('created_at', { ascending: false })
    .limit(30);

  const withSignedUrls = await Promise.all(
    (records ?? []).map(async (r) => {
      if (r.type === 'photo' && r.payload?.storage_path) {
        const { data } = await supabase.storage.from('patient-photos').createSignedUrl(r.payload.storage_path, 3600);
        return { ...r, signedUrl: data?.signedUrl };
      }
      return r;
    })
  );

  return NextResponse.json({ records: withSignedUrls });
}
