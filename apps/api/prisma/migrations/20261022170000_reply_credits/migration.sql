-- AlterEnum
ALTER TYPE "PaymentKind" ADD VALUE 'REPLY_CREDITS';

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "replyCredits" INTEGER;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "replyCredits" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Usage" ADD COLUMN     "replyCreditUsed" INTEGER NOT NULL DEFAULT 0;

