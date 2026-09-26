-- CreateEnum
CREATE TYPE "RuleChannel" AS ENUM ('ALL', 'COMMENT', 'DIRECT');

-- CreateEnum
CREATE TYPE "MatchType" AS ENUM ('CONTAINS', 'EXACT', 'ANY');

-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'IGNORED';

-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "channel" "RuleChannel" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "hitCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastTriggeredAt" TIMESTAMP(3),
ADD COLUMN     "matchType" "MatchType" NOT NULL DEFAULT 'CONTAINS',
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "privateReply" TEXT,
ALTER COLUMN "trigger" SET DEFAULT '';

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SocialMessage" ADD COLUMN     "authorId" TEXT,
ADD COLUMN     "error" TEXT,
ADD COLUMN     "postId" TEXT,
ADD COLUMN     "repliedAt" TIMESTAMP(3),
ADD COLUMN     "ruleId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "SocialMessage_accountId_status_idx" ON "SocialMessage"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "SocialMessage_accountId_externalId_key" ON "SocialMessage"("accountId", "externalId");

-- AddForeignKey
ALTER TABLE "SocialMessage" ADD CONSTRAINT "SocialMessage_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "AutomationRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

