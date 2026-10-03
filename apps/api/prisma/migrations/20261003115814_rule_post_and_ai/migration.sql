-- AlterTable
ALTER TABLE "AutomationRule" ADD COLUMN     "postId" TEXT,
ADD COLUMN     "postLabel" TEXT,
ADD COLUMN     "useAi" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "response" DROP NOT NULL;
