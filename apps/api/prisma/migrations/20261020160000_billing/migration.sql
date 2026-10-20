-- CreateEnum
CREATE TYPE "PlanId" AS ENUM ('STARTER', 'PRO', 'BUSINESS', 'AGENCY');

-- CreateEnum
CREATE TYPE "BillingPeriod" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SubscriptionKind" AS ENUM ('TRIAL', 'PAID', 'MANUAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "activeSince" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "linkedPageId" TEXT;

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanId" NOT NULL DEFAULT 'PRO',
    "kind" "SubscriptionKind" NOT NULL DEFAULT 'TRIAL',
    "billingPeriod" "BillingPeriod",
    "periodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "customLimits" JSONB,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "plan" "PlanId" NOT NULL,
    "period" "BillingPeriod" NOT NULL,
    "amount" INTEGER NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paymentLink" TEXT,
    "shortLink" TEXT,
    "linkExpiresAt" TIMESTAMP(3),
    "notificationToken" TEXT,
    "papiReference" TEXT,
    "paymentMethod" TEXT,
    "fee" INTEGER,
    "payerPhone" TEXT,
    "failureMessage" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "appliedPeriodEnd" TIMESTAMP(3),
    "extraDays" INTEGER,
    "raw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Usage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "aiReplies" INTEGER NOT NULL DEFAULT 0,
    "liveSeconds" INTEGER NOT NULL DEFAULT 0,
    "aiQuotaHitAt" TIMESTAMP(3),
    "liveQuotaHitAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_reference_key" ON "Payment"("reference");

-- CreateIndex
CREATE INDEX "Payment_userId_createdAt_idx" ON "Payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Payment_status_createdAt_idx" ON "Payment"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Usage_userId_month_key" ON "Usage"("userId", "month");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Usage" ADD CONSTRAINT "Usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Rattrapage : 14 jours d'essai Pro pour chaque compte existant
INSERT INTO "Subscription" ("id", "userId", "plan", "kind", "periodEnd", "trialEndsAt", "createdAt", "updatedAt")
SELECT 'sub_' || u."id", u."id", 'PRO'::"PlanId", 'TRIAL'::"SubscriptionKind",
       NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days', NOW(), NOW()
FROM "User" u
ON CONFLICT ("userId") DO NOTHING;

-- Lives en cours : le décompte des heures commence maintenant
UPDATE "LiveSession" SET "activeSince" = NOW() WHERE "status" = 'ACTIVE';

-- Comptes Instagram : rattachés à leur Page Facebook (même jeton de Page)
UPDATE "SocialAccount" ig SET "linkedPageId" = fb."externalId"
FROM "SocialAccount" fb
WHERE ig."platform" = 'INSTAGRAM' AND fb."platform" = 'FACEBOOK'
  AND ig."userId" = fb."userId" AND ig."accessToken" = fb."accessToken"
  AND ig."linkedPageId" IS NULL;
