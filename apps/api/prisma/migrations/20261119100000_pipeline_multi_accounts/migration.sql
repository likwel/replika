-- Un pipeline peut viser plusieurs comptes (liste vide = tous les comptes)
ALTER TABLE "Pipeline" ADD COLUMN "accountIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Reprise des pipelines existants : l'ancien compte unique devient une liste d'un compte
UPDATE "Pipeline" SET "accountIds" = ARRAY["accountId"], "accountId" = NULL WHERE "accountId" IS NOT NULL;
