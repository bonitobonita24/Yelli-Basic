-- DropForeignKey
ALTER TABLE "invitations" DROP CONSTRAINT "invitations_invited_by_user_id_fkey";

-- AlterTable
ALTER TABLE "invitations" ALTER COLUMN "invited_by_user_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_user_id_fkey" FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
