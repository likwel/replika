-- CreateEnum
CREATE TYPE "PaymentKind" AS ENUM ('SUBSCRIPTION', 'LIVE_HOURS');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "kind" "PaymentKind" NOT NULL DEFAULT 'SUBSCRIPTION',
ADD COLUMN     "liveHours" INTEGER,
ALTER COLUMN "plan" DROP NOT NULL,
ALTER COLUMN "period" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "liveCreditSeconds" INTEGER NOT NULL DEFAULT 0;

