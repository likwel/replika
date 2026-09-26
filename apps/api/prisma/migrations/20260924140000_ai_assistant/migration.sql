-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "aiAutoSend" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiChannel" "RuleChannel" NOT NULL DEFAULT 'ALL',
ADD COLUMN     "aiContext" TEXT,
ADD COLUMN     "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "aiInstructions" TEXT;

-- AlterTable
ALTER TABLE "SocialMessage" ADD COLUMN     "aiGenerated" BOOLEAN NOT NULL DEFAULT false;

