"use client";

import { Turnstile } from "@marsidev/react-turnstile";

interface Props {
  onVerify: (token: string) => void;
  onExpire?: (token: string) => void;
}

/**
 * Cloudflare Turnstile widget (LOCKED: turnstile.enabled=true).
 * Renders the managed widget — server-side siteverify happens inside
 * Auth.js authorize() callback (src/server/auth/config.ts).
 *
 * Dev + staging use Cloudflare test keys (always pass) per security.md
 * Turnstile section. Production must replace NEXT_PUBLIC_TURNSTILE_SITE_KEY.
 */
export function TurnstileWidget({ onVerify, onExpire }: Props) {
  return (
    <Turnstile
      siteKey={
        process.env["NEXT_PUBLIC_TURNSTILE_SITE_KEY"] ??
        "1x00000000000000000000AA"
      }
      options={{ theme: "light", size: "flexible" }}
      onSuccess={onVerify}
      onExpire={onExpire}
    />
  );
}
