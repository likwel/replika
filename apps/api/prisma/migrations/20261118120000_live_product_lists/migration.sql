-- CreateTable
CREATE TABLE "LiveProductList" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "mapping" JSONB NOT NULL,
    "headers" TEXT[],
    "rows" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "lastSyncAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastMessage" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveProductList_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LiveProductList_userId_idx" ON "LiveProductList"("userId");

-- AddForeignKey
ALTER TABLE "LiveProductList" ADD CONSTRAINT "LiveProductList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
