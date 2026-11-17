-- AlterTable
ALTER TABLE "SocialMessage" ADD COLUMN "seenAt" TIMESTAMP(3);

-- Les messages existants sont considérés comme vus : la bulle de notification ne compte que les nouveautés à partir de maintenant
UPDATE "SocialMessage" SET "seenAt" = "createdAt";

-- CreateIndex
CREATE INDEX "SocialMessage_accountId_status_seenAt_idx" ON "SocialMessage"("accountId", "status", "seenAt");
