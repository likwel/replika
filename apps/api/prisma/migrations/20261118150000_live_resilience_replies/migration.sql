-- AlterTable
ALTER TABLE "LiveOrder" ADD COLUMN "contactedAt" TIMESTAMP(3);

-- Les commandes existantes ont déjà été traitées : seules les nouvelles pourront être reprises après un arrêt du serveur
UPDATE "LiveOrder" SET "contactedAt" = "createdAt";

-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN "replyMode" TEXT NOT NULL DEFAULT 'ALL',
ADD COLUMN "replyRuleIds" TEXT[],
ADD COLUMN "replyUseAi" BOOLEAN NOT NULL DEFAULT true;
