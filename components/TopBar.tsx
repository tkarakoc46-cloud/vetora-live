import { signOut } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export async function TopBar() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let homeHref = '/dashboard';
  if (user) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (profile?.role === 'ADMIN') homeHref = '/admin';
  }

  return (
    <div className="bg-navy text-white flex items-center justify-between px-5 py-3 no-print">
      <div className="flex items-center gap-4">
        <Link href={homeHref} className="font-display font-bold">
          Vetora Live
        </Link>
        <Link href="/patients" className="text-xs font-semibold text-white/80 hover:text-white">
          Tüm Hastalar
        </Link>
      </div>
      <form action={signOut}>
        <button className="text-xs font-semibold bg-white/10 border border-white/25 rounded-lg px-3 py-1.5">
          Çıkış Yap
        </button>
      </form>
    </div>
  );
}
