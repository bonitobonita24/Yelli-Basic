-- V32.9 Compliance + Data Privacy layer (PH RA 10173 / NPC).
-- These 4 models + 5 enums were added to schema.prisma (commit d639a5b) without a
-- migration — drift on main. This created a runtime 500 on /settings (DSR query hit a
-- missing data_subject_requests table). This migration captures the FULL compliance
-- drift: consent_logs, data_subject_requests, breach_notification_records,
-- retention_policies + their enums + the AuditTargetType additions, with RLS (L2)
-- tenant-isolation parity to 0001_init.
-- Numbered 0005 (not 0004): 0004_add_third_device is reserved for the in-flight
-- feat/three-way-call-screenshare branch (independent table; both apply cleanly).

-- CreateEnum
CREATE TYPE "LawfulBasis" AS ENUM ('CONSENT', 'CONTRACT', 'LEGAL_OBLIGATION', 'LEGITIMATE_INTEREST', 'VITAL_INTEREST', 'PUBLIC_AUTHORITY');

-- CreateEnum
CREATE TYPE "DsrType" AS ENUM ('INFORM', 'OBJECT', 'ACCESS', 'RECTIFY', 'ERASE', 'PORT');

-- CreateEnum
CREATE TYPE "DsrStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED');

-- CreateEnum
CREATE TYPE "BreachStatus" AS ENUM ('DETECTED', 'ASSESSED', 'NOTIFIED', 'REPORTED', 'CLOSED');

-- CreateEnum
CREATE TYPE "BreachSeverity" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterEnum
-- These values are added but NOT used within this migration's transaction (PG12+ safe).
ALTER TYPE "AuditTargetType" ADD VALUE 'DataSubjectRequest';
ALTER TYPE "AuditTargetType" ADD VALUE 'BreachNotificationRecord';
ALTER TYPE "AuditTargetType" ADD VALUE 'ConsentLog';

-- CreateTable
CREATE TABLE "consent_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "lawful_basis" "LawfulBasis" NOT NULL,
    "notice_version" TEXT NOT NULL,
    "granted" BOOLEAN NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),

    CONSTRAINT "consent_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "data_subject_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "DsrType" NOT NULL,
    "status" "DsrStatus" NOT NULL DEFAULT 'RECEIVED',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "evidence_url" TEXT,

    CONSTRAINT "data_subject_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "breach_notification_records" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "severity" "BreachSeverity" NOT NULL,
    "status" "BreachStatus" NOT NULL DEFAULT 'DETECTED',
    "detected_at" TIMESTAMP(3) NOT NULL,
    "npc_notified_at" TIMESTAMP(3),
    "subjects_notified_at" TIMESTAMP(3),
    "written_report_due_at" TIMESTAMP(3) NOT NULL,
    "written_report_submitted_at" TIMESTAMP(3),
    "affected_user_count" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "recorded_by_user_id" TEXT,

    CONSTRAINT "breach_notification_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retention_policies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "retain_days" INTEGER NOT NULL,
    "legal_hold" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "retention_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "consent_logs_tenant_id_user_id_idx" ON "consent_logs"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "data_subject_requests_tenant_id_user_id_idx" ON "data_subject_requests"("tenant_id", "user_id");

-- CreateIndex
CREATE INDEX "breach_notification_records_tenant_id_idx" ON "breach_notification_records"("tenant_id");

-- CreateIndex
CREATE INDEX "breach_notification_records_tenant_id_detected_at_idx" ON "breach_notification_records"("tenant_id", "detected_at");

-- CreateIndex
CREATE INDEX "retention_policies_tenant_id_idx" ON "retention_policies"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "retention_policies_tenant_id_entity_key" ON "retention_policies"("tenant_id", "entity");

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consent_logs" ADD CONSTRAINT "consent_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "data_subject_requests" ADD CONSTRAINT "data_subject_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_notification_records" ADD CONSTRAINT "breach_notification_records_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "breach_notification_records" ADD CONSTRAINT "breach_notification_records_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "retention_policies" ADD CONSTRAINT "retention_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Row Level Security (L2) — tenant-isolation parity with 0001_init.
-- All four tables are tenant-scoped (tenant_id NOT NULL). Policies read
-- current_setting('app.current_tenant_id', true); the `true` arg returns NULL
-- (not an error) when unset. Mirrors the established pattern exactly.
ALTER TABLE "consent_logs" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "consent_logs"
  USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE "data_subject_requests" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "data_subject_requests"
  USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE "breach_notification_records" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "breach_notification_records"
  USING (tenant_id = current_setting('app.current_tenant_id', true));

ALTER TABLE "retention_policies" ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON "retention_policies"
  USING (tenant_id = current_setting('app.current_tenant_id', true));
