-- AlterTable
ALTER TABLE "LiveSession" ADD COLUMN     "deliveryFee" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "recapMessage" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "LiveInvoice" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerKey" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "itemsTotal" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "orderIds" TEXT[],
    "sentAt" TIMESTAMP(3),
    "sendError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LiveInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LiveInvoice_sessionId_customerKey_key" ON "LiveInvoice"("sessionId", "customerKey");

-- AddForeignKey
ALTER TABLE "LiveInvoice" ADD CONSTRAINT "LiveInvoice_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "LiveSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
