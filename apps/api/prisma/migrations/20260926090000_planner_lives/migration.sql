-- CreateEnum
CREATE TYPE "ScheduleKind" AS ENUM ('POST', 'COMMENT', 'MESSAGE');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHING', 'DONE', 'PARTIAL', 'FAILED');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('PENDING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "LiveSessionStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "LiveOrderStatus" AS ENUM ('NEW', 'MESSAGED', 'PARTIAL', 'CONFIRMED', 'WAITLIST', 'DELIVERED', 'CANCELED');

-- CreateTable
CREATE TABLE "Schedule" (
    "id" TEXT NOT NULL,
    "kind" "ScheduleKind" NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'DRAFT',
    "text" TEXT NOT NULL,
    "imageUrl" TEXT,
    "link" TEXT,
    "messageTag" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "error" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleTarget" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "refId" TEXT,
    "label" TEXT,
    "status" "TargetStatus" NOT NULL DEFAULT 'PENDING',
    "externalId" TEXT,
    "permalink" TEXT,
    "error" TEXT,
    "doneAt" TIMESTAMP(3),

    CONSTRAINT "ScheduleTarget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveSession" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "LiveSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "sourceType" TEXT NOT NULL,
    "objectId" TEXT NOT NULL,
    "postId" TEXT,
    "liveVideoId" TEXT,
    "liveStatus" TEXT,
    "permalink" TEXT,
    "thumbnail" TEXT,
    "keywords" TEXT NOT NULL DEFAULT 'jp, j''prends, jprends, je prends',
    "requiredFields" TEXT NOT NULL DEFAULT 'nom,telephone,adresse',
    "autoMessage" BOOLEAN NOT NULL DEFAULT true,
    "replyPublic" TEXT,
    "firstMessage" TEXT NOT NULL,
    "missingMessage" TEXT NOT NULL,
    "confirmMessage" TEXT NOT NULL,
    "soldOutMessage" TEXT NOT NULL,
    "cursor" TIMESTAMP(3),
    "lastPolledAt" TIMESTAMP(3),
    "syncError" TEXT,
    "endedAt" TIMESTAMP(3),
    "accountId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveProduct" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER,
    "stock" INTEGER,

    CONSTRAINT "LiveProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveComment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isJp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiveOrder" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "commentId" TEXT,
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "recipientId" TEXT,
    "comment" TEXT NOT NULL,
    "code" TEXT,
    "productName" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" INTEGER,
    "fullName" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "note" TEXT,
    "replies" TEXT,
    "status" "LiveOrderStatus" NOT NULL DEFAULT 'NEW',
    "reminders" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_status_scheduledAt_idx" ON "Schedule"("status", "scheduledAt");

-- CreateIndex
CREATE INDEX "Schedule_userId_scheduledAt_idx" ON "Schedule"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "LiveSession_accountId_status_idx" ON "LiveSession"("accountId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LiveProduct_sessionId_code_key" ON "LiveProduct"("sessionId", "code");

-- CreateIndex
CREATE INDEX "LiveComment_sessionId_createdAt_idx" ON "LiveComment"("sessionId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "LiveComment_sessionId_externalId_key" ON "LiveComment"("sessionId", "externalId");

-- CreateIndex
CREATE INDEX "LiveOrder_sessionId_recipientId_idx" ON "LiveOrder"("sessionId", "recipientId");

-- CreateIndex
CREATE UNIQUE INDEX "LiveOrder_sessionId_commentId_key" ON "LiveOrder"("sessionId", "commentId");

-- AddForeignKey
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTarget" ADD CONSTRAINT "ScheduleTarget_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleTarget" ADD CONSTRAINT "ScheduleTarget_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SocialAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveSession" ADD CONSTRAINT "LiveSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveProduct" ADD CONSTRAINT "LiveProduct_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveComment" ADD CONSTRAINT "LiveComment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LiveOrder" ADD CONSTRAINT "LiveOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

