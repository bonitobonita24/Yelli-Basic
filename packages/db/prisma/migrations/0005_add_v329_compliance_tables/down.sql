-- Reverse migration for 0005_add_v329_compliance_tables
-- Drop order: policies → RLS disable → tables (reverse FK dependency) → enums.
-- NOTE: The three AuditTargetType enum VALUES added by the up migration
-- (DataSubjectRequest / BreachNotificationRecord / ConsentLog) are intentionally
-- NOT removed here — PostgreSQL cannot DROP a value from an enum without recreating
-- the type. Leaving the extra values is harmless (additive, no rows reference them
-- after the tables are dropped).

DROP POLICY IF EXISTS tenant_isolation ON "retention_policies";
DROP POLICY IF EXISTS tenant_isolation ON "breach_notification_records";
DROP POLICY IF EXISTS tenant_isolation ON "data_subject_requests";
DROP POLICY IF EXISTS tenant_isolation ON "consent_logs";

ALTER TABLE "retention_policies" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "breach_notification_records" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "data_subject_requests" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "consent_logs" DISABLE ROW LEVEL SECURITY;

DROP TABLE IF EXISTS "retention_policies";
DROP TABLE IF EXISTS "breach_notification_records";
DROP TABLE IF EXISTS "data_subject_requests";
DROP TABLE IF EXISTS "consent_logs";

DROP TYPE IF EXISTS "BreachSeverity";
DROP TYPE IF EXISTS "BreachStatus";
DROP TYPE IF EXISTS "DsrStatus";
DROP TYPE IF EXISTS "DsrType";
DROP TYPE IF EXISTS "LawfulBasis";
