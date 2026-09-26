-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "dmSyncedAt" TIMESTAMP(3),
ADD COLUMN     "syncError" TEXT;

