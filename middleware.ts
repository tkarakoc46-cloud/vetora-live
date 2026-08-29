import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refreshes the Supabase Auth session cookie on every request and gates
// the staff/admin app: signed-out visitors to anything under /dashboard,
// /patients, /admin get bounced to /login. Owner routes (/p/[token]) are
// intentionally untouched — they never use Supabase Auth at all.
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const protectedPrefixes = ['/dashboard', '/patients', '/admin', '/tasks', '/profile'];
  const needsAuth = protectedPrefixes.some((p) => request.nextUrl.pathname.startsWith(p));

  if (needsAuth && !user) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ['/dashboard/:path*', '/patients/:path*', '/admin/:path*', '/tasks/:path*', '/profile/:path*'],
};
