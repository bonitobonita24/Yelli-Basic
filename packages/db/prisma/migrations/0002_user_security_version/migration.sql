-- Add securityVersion column to users for session invalidation (V28 / security.md Auth Defaults #6).
-- Increment on role change, tenant change, account suspension, or password change.
-- Auth.js session callback compares session.securityVersion against this value;
-- mismatch → force re-authentication (covers role escalation/de-escalation + suspension).

ALTER TABLE "users" ADD COLUMN "security_version" INTEGER NOT NULL DEFAULT 0;
