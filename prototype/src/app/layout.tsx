import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'Yelli Prototype (Phase 3.3)',
  description:
    'Client-validated interactive prototype for Yelli — simulated backend, V32.6 Phase 3.3.',
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canvas text-text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
