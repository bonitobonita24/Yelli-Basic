import type { NextConfig } from 'next';

// HTTP security headers — applied to every response (Phase 4 Part 5 mandate).
// CSP starts permissive for dev (style/script inline for Tailwind + RSC); tighten
// per env in a later hardening pass. connect-src is widened to ws:/wss: so the
// WebRTC signaling socket can connect: in dev it is a SEPARATE origin (the
// signaling server runs on its own port, e.g. ws://localhost:46850/ws), which
// 'self' does NOT cover; in LAN/Cloud signaling is same-origin wss:// behind the
// proxy. (STUN/TURN ICE is not gated by connect-src.) Hardening follow-up: scope
// ws:/wss: to the exact signaling origin per edition.
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Yelli is a WebRTC calling app — camera + microphone MUST be allowed for self.
  {
    key: 'Permissions-Policy',
    value: 'camera=(self), microphone=(self), geolocation=(), payment=()',
  },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Inter is self-hosted via next/font (W7) — no Google Fonts origins needed; fonts
      // and their @font-face stylesheet are served from 'self'.
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output for the Docker image pipeline (docker.publish: true).
  output: 'standalone',
  // @yelli/* workspace packages ship TypeScript source (no build step) — Next
  // must transpile them. @yelli/db is server-only (Prisma); never imported at edge.
  // @yelli/jobs (W3) is the BullMQ producer surface for the invitation email trigger.
  // @yelli/storage (W4) is the S3/MinIO branding-upload surface.
  transpilePackages: ['@yelli/ui', '@yelli/db', '@yelli/shared', '@yelli/jobs', '@yelli/storage'],
  // bullmq does dynamic requires (Lua command scripts, cron-parser) that the bundler
  // can't statically trace; @aws-sdk/client-s3 is a heavy server-only SDK. Keep both
  // external and require them at runtime (Node server).
  serverExternalPackages: ['bullmq', '@aws-sdk/client-s3'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  // /login is served by the branded login page (app/login/page.tsx).
  // Auth.js pages.signIn = '/login' routes unauthenticated users there directly —
  // no next.config redirect needed any more.
  async redirects() {
    return [];
  },
};

export default nextConfig;
