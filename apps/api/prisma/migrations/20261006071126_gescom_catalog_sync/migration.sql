-- CreateEnum
CREATE TYPE "MarketplaceListingSource" AS ENUM ('MANUAL', 'CATALOG');

-- AlterTable
ALTER TABLE "MarketplaceListing" ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "source" "MarketplaceListingSource" NOT NULL DEFAULT 'MANUAL';

-- AlterTable
ALTER TABLE "SocialAccount" ADD COLUMN     "catalogId" TEXT,
ADD COLUMN     "catalogName" TEXT,
ADD COLUMN     "catalogSyncedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "MarketplaceListing_accountId_externalId_idx" ON "MarketplaceListing"("accountId", "externalId");
