-- AlterTable
ALTER TABLE "services" ADD COLUMN     "photo_alt" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "photo_height" INTEGER,
ADD COLUMN     "photo_key" TEXT,
ADD COLUMN     "photo_width" INTEGER;

-- CreateTable
CREATE TABLE "service_photos" (
    "service_id" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "content_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_photos_pkey" PRIMARY KEY ("service_id")
);

-- AddForeignKey
ALTER TABLE "service_photos" ADD CONSTRAINT "service_photos_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;
