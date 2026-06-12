-- Reverse migration for 0001_init
-- Drop order: RLS policies → RLS disable → tables (reverse FK dependency) → enums

DROP POLICY IF EXISTS tenant_isolation ON "audit_logs";
DROP POLICY IF EXISTS tenant_isolation ON "web_push_subscriptions";
DROP POLICY IF EXISTS tenant_isolation ON "export_jobs";
DROP POLICY IF EXISTS tenant_isolation ON "call_sessions";
DROP POLICY IF EXISTS tenant_isolation ON "invitations";
DROP POLICY IF EXISTS tenant_isolation ON "devices";
DROP POLICY IF EXISTS tenant_isolation ON "users";

ALTER TABLE "audit_logs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "web_push_subscriptions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "export_jobs" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "call_sessions" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "invitations" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "devices" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "users" DISABLE ROW LEVEL SECURITY;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS "export_jobs" CASCADE;
DROP TABLE IF EXISTS "web_push_subscriptions" CASCADE;
DROP TABLE IF EXISTS "call_sessions" CASCADE;
DROP TABLE IF EXISTS "audit_logs" CASCADE;
DROP TABLE IF EXISTS "verification_tokens" CASCADE;
DROP TABLE IF EXISTS "sessions" CASCADE;
DROP TABLE IF EXISTS "accounts" CASCADE;
DROP TABLE IF EXISTS "invitations" CASCADE;
DROP TABLE IF EXISTS "devices" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "tenants" CASCADE;

-- Drop enums
DROP TYPE IF EXISTS "ExportJobStatus";
DROP TYPE IF EXISTS "EndReason";
DROP TYPE IF EXISTS "AuditTargetType";
DROP TYPE IF EXISTS "CallRole";
DROP TYPE IF EXISTS "Role";
