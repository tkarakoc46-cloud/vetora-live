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
    <div className="bg-navy text-white flex items-center justify-between gap-2 px-3 sm:px-5 py-3 no-print">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        <Link href={homeHref} className="flex items-center gap-2 font-display font-bold text-xs sm:text-sm whitespace-nowrap shrink-0">
          <img src="/icons/logo-mark-transparent.png" alt="" className="h-6 w-6 shrink-0" />
          MED CARE ANIMALS
        </Link>
        <Link href="/patients" className="text-xs font-semibold text-white/80 hover:text-white whitespace-nowrap">
          Tüm Hastalar
        </Link>
      </div>
      <form action={signOut} className="shrink-0">
        <button className="text-xs font-semibold bg-white/10 border border-white/25 rounded-lg px-2.5 sm:px-3 py-1.5 whitespace-nowrap">
          Çıkış Yap
        </button>
      </form>
    </div>
  );
}
