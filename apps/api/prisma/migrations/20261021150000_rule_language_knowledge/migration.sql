-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "aiKnowledge" TEXT,
ADD COLUMN     "language" TEXT NOT NULL DEFAULT 'ACCOUNT';

