import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import { Providers } from '@/lib/providers';
import { auth } from '@/server/auth/config';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yelli',
  description: 'Dual-mode (LAN + Cloud) peer-to-peer calling for marine ops and small teams.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Resolve the session server-side so the first paint carries real auth state.
  const session = await auth();
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-text-primary antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
