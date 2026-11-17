-- CreateTable
CREATE TABLE "ScheduleSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "accountIds" TEXT[],
    "asDraft" BOOLEAN NOT NULL DEFAULT false,
    "autoSync" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 60,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastMessage" TEXT,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduleSourceRow" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "rowKey" TEXT NOT NULL,
    "scheduleId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleSourceRow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleSource_userId_idx" ON "ScheduleSource"("userId");

-- CreateIndex
CREATE INDEX "ScheduleSource_autoSync_lastSyncAt_idx" ON "ScheduleSource"("autoSync", "lastSyncAt");

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleSourceRow_sourceId_rowKey_key" ON "ScheduleSourceRow"("sourceId", "rowKey");

-- AddForeignKey
ALTER TABLE "ScheduleSource" ADD CONSTRAINT "ScheduleSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScheduleSourceRow" ADD CONSTRAINT "ScheduleSourceRow_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "ScheduleSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
