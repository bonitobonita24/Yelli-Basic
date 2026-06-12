import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yelli',
  description: 'Dual-mode (LAN + Cloud) peer-to-peer calling for marine ops and small teams.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-text-primary antialiased">{children}</body>
    </html>
  );
}
