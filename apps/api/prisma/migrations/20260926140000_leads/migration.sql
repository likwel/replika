-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "personKey" TEXT NOT NULL,
    "personId" TEXT,
    "psid" TEXT,
    "name" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "signals" TEXT[],
    "intent" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "lastMessage" TEXT NOT NULL,
    "lastSource" TEXT NOT NULL,
    "postId" TEXT,
    "messageCount" INTEGER NOT NULL DEFAULT 1,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "value" INTEGER,
    "note" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Lead_accountId_psid_idx" ON "Lead"("accountId", "psid");

-- CreateIndex
CREATE INDEX "Lead_userId_status_score_idx" ON "Lead"("userId", "status", "score");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_accountId_personKey_key" ON "Lead"("accountId", "personKey");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

