import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Börü Care',
  description: 'Veteriner yatılı hasta takip sistemi',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Börü Care',
  },
  icons: {
    icon: '/icons/favicon-32.png',
    apple: '/icons/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#131C3B',
  width: 'device-width',
  initialScale: 1,
  // locks the app to phone-app-like behavior — no pinch-zoom, no
  // accidental pull-to-refresh feel once installed as a PWA/APK
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        {children}
        <script
          // Registers the minimal service worker (see public/sw.js) — required
          // for Chrome/Android's "Add to Home Screen" install prompt and for
          // PWABuilder to package this as an installable Android app/APK.
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                  navigator.serviceWorker.register('/sw.js').catch(() => {});
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
