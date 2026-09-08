import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Hasta sahibinin gördüğü /p/[token] sayfası hiç oturum/çerez kullanmıyor
// (bkz. app/p/[token]/page.tsx — force-dynamic ile her istekte veritabanından
// taze okunuyor), ama personel raporladı: bazı hasta sahipleri hâlâ ESKİ
// (hatta silinmiş) bir belgeyi görmeye devam ediyordu — büyük ihtimalle
// linki WhatsApp'ın kendi uygulama-içi tarayıcısı (in-app browser) üzerinden
// açtıkları için, o tarayıcı sayfayı kendi telefonunda önbelleğe alıyor.
// Next.js'in "force-dynamic" ayarı SUNUCUNUN yeniden render etmesini
// garanti eder ama hangi HTTP yanıt başlıklarının (headers) gittiğini
// garanti etmez; burada açıkça "hiçbir şeyi önbelleğe alma" başlıklarını
// EKLEYEREK hem tarayıcıya hem araya giren herhangi bir vekil/CDN'e bunu
// açıkça söylüyoruz — bu, in-app tarayıcıların önbellekleme davranışına
// karşı bilinen en güvenilir savunma.
function withNoStore(response: NextResponse) {
  response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  response.headers.set('Pragma', 'no-cache');
  response.headers.set('Expires', '0');
  return response;
}

export async function middleware(request: NextRequest) {
  // Hasta sahibi linki (/p/[token]): oturum/çerez yok, sadece önbellek
  // başlıklarını sıkılaştırıp geç — Supabase auth akışına hiç girmeye
  // gerek yok.
  if (request.nextUrl.pathname.startsWith('/p/')) {
    return withNoStore(NextResponse.next({ request: { headers: request.headers } }));
  }

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
  matcher: ['/dashboard/:path*', '/patients/:path*', '/admin/:path*', '/tasks/:path*', '/profile/:path*', '/p/:path*'],
};
