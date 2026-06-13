import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { PwaGlobalChrome } from '@/components/pwa/pwa-global-chrome';
import { ReplayQueueProvider } from '@/components/pwa/replay-queue-provider';
import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { Providers } from '@/lib/providers';
import { auth } from '@/server/auth/config';
import './globals.css';

// Self-hosted via next/font — no runtime Google Fonts request (W7 / Phase 3.3 deferral #3:
// font loading). Inter is a variable font, so no `weight` is needed (the full 400–700 range
// the prototype used is available). Exposed as a CSS variable so globals.css keeps driving
// the font-family (single design-token surface, Output Equivalence with the GREEN baseline).
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'Yelli',
  description: 'Dual-mode (LAN + Cloud) peer-to-peer calling for marine ops and small teams.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, title: 'Yelli', statusBarStyle: 'default' },
};

// Next 16 moved themeColor out of `metadata` into the `viewport` export.
export const viewport: Viewport = {
  themeColor: '#1a3a3a',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Resolve the session server-side so the first paint carries real auth state.
  const session = await auth();
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-canvas text-text-primary antialiased">
        <ServiceWorkerRegister />
        <Providers session={session}>
          {/* W6b: one replay queue for the whole tree; PWA chrome spans all routes. */}
          <ReplayQueueProvider>
            <PwaGlobalChrome />
            {children}
          </ReplayQueueProvider>
        </Providers>
      </body>
    </html>
  );
}
