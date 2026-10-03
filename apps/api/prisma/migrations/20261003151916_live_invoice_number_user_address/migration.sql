-- AlterTable
ALTER TABLE "LiveInvoice" ADD COLUMN     "invoiceNumber" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "address" TEXT;
