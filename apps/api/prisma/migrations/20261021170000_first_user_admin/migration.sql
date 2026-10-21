-- Le premier compte inscrit devient administrateur (tableau de bord /app/admin), s'il n'y en a pas encore
UPDATE "User" SET "role" = 'ADMIN'
WHERE "id" = (SELECT "id" FROM "User" ORDER BY "createdAt" ASC LIMIT 1)
  AND NOT EXISTS (SELECT 1 FROM "User" WHERE "role" = 'ADMIN');
