-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "actorId" TEXT,
ADD COLUMN     "actorName" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "activeOwnerId" TEXT;

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "userId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'CUSTOM',
    "permissions" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'INVITED',
    "inviteTokenHash" TEXT,
    "inviteExpiresAt" TIMESTAMP(3),
    "joinedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_inviteTokenHash_key" ON "TeamMember"("inviteTokenHash");

-- CreateIndex
CREATE INDEX "TeamMember_userId_idx" ON "TeamMember"("userId");

-- CreateIndex
CREATE INDEX "TeamMember_email_idx" ON "TeamMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_ownerId_email_key" ON "TeamMember"("ownerId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_ownerId_userId_key" ON "TeamMember"("ownerId", "userId");

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamMember" ADD CONSTRAINT "TeamMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

