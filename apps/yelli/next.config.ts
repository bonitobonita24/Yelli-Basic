import type { NextConfig } from 'next';

// HTTP security headers — applied to every response (Phase 4 Part 5 mandate).
// CSP starts permissive for dev (style/script inline for Tailwind + RSC); tighten
// per env in a later hardening pass. connect-src is widened to ws/wss by the
// calling-wire sessions (WebRTC signaling + STUN/TURN) — kept 'self' here.
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
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Standalone output for the Docker image pipeline (docker.publish: true).
  output: 'standalone',
  // @yelli/ui ships TypeScript source (no build step) — Next must transpile it.
  transpilePackages: ['@yelli/ui'],
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};

export default nextConfig;
