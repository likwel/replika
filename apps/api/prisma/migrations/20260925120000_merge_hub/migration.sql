-- Actualités et Messages sont fusionnées dans Gestion
ALTER TABLE "User" ALTER COLUMN "defaultPage" SET DEFAULT 'gestion';
UPDATE "User" SET "defaultPage" = 'gestion' WHERE "defaultPage" IN ('actualites', 'messages');
