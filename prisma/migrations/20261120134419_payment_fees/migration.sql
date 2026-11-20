-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "customerFeeKobo" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "paystackFeeKobo" INTEGER;
