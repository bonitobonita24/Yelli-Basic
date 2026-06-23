-- Additive, backward-compatible: optional 3rd call participant (hard cap 3).
-- Existing rows get NULL (1-on-1 calls). Mirrors callee_device_id FK semantics.

-- AlterTable
ALTER TABLE "call_sessions" ADD COLUMN "third_device_id" TEXT;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_third_device_id_fkey" FOREIGN KEY ("third_device_id") REFERENCES "devices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
