-- AlterTable
ALTER TABLE "User" ADD COLUMN     "accentTheme" TEXT NOT NULL DEFAULT 'whatsapp',
ADD COLUMN     "darkMode" BOOLEAN NOT NULL DEFAULT false;
