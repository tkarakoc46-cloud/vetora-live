import { signOut } from '@/lib/actions/auth';

export function TopBar() {
  return (
    <div className="bg-navy text-white flex items-center justify-between px-5 py-3">
      <div className="font-display font-bold">Vetora Live</div>
      <form action={signOut}>
        <button className="text-xs font-semibold bg-white/10 border border-white/25 rounded-lg px-3 py-1.5">
          Çıkış Yap
        </button>
      </form>
    </div>
  );
}
