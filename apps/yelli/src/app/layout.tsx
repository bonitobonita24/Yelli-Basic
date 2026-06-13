import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { ServiceWorkerRegister } from '@/components/pwa/service-worker-register';
import { Providers } from '@/lib/providers';
import { auth } from '@/server/auth/config';
import './globals.css';

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
    <html lang="en">
      <body className="min-h-screen bg-canvas text-text-primary antialiased">
        <ServiceWorkerRegister />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
