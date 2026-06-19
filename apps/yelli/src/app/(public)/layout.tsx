import type { ReactNode } from 'react';

/**
 * (public) route group layout — shared wrapper for unauthenticated public routes
 * (/setup, /admin/login, /privacy, …).
 *
 * This layout is intentionally minimal: it passes children through without adding a
 * footer here because individual public pages vary widely in structure (fullscreen
 * setup/login forms vs. the scrollable privacy policy page). The ComplianceFooter is
 * rendered directly by pages that need it (e.g. /privacy/page.tsx).
 *
 * V32.9: route group created to satisfy the Next.js App Router requirement for a
 * shared layout file, and to make future public-route additions explicit.
 */
export default function PublicLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
