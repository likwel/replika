-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "tokenCheckedAt" TIMESTAMP(3),
ADD COLUMN     "tokenScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "tokenValid" BOOLEAN;

