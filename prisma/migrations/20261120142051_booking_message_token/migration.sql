-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "messageTokenHash" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Booking_messageTokenHash_key" ON "Booking"("messageTokenHash");

