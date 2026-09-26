-- AlterTable
ALTER TABLE "User" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "companyName" TEXT,
ADD COLUMN     "defaultPage" TEXT NOT NULL DEFAULT 'actualites',
ADD COLUMN     "desktopNotifications" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

