-- Migration: 0003_user_removed_at
-- Add User.removedAt for the 7-day soft-delete grace period (DECISIONS_LOG q-W5-01).
-- Set by removeMember alongside isSuspended=true; hard-deleted by soft-delete-cron
-- after 7 days. FK cascade for hard-delete: DELETE outgoing Invitations (NOT NULL FK,
-- no standalone value), SET NULL AuditLog.actorUserId (nullable; 7yr retention must
-- survive actor deletion).

ALTER TABLE "users" ADD COLUMN "removed_at" TIMESTAMP(3);

-- Index for efficient cron sweep: find users past the 7-day grace period.
CREATE INDEX "users_removed_at_idx" ON "users"("removed_at") WHERE "removed_at" IS NOT NULL;
