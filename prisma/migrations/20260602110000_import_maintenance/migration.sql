ALTER TABLE "ImportBatchItem" ADD COLUMN IF NOT EXISTS "quantityImported" INTEGER;
ALTER TABLE "ImportBatchItem" ADD COLUMN IF NOT EXISTS "duplicateBehaviorUsed" TEXT;
ALTER TABLE "ImportBatchItem" ADD COLUMN IF NOT EXISTS "createdNewInventoryItem" BOOLEAN;
ALTER TABLE "ImportBatchItem" ADD COLUMN IF NOT EXISTS "updatedExistingInventoryItem" BOOLEAN;
ALTER TABLE "ImportBatchItem" ADD COLUMN IF NOT EXISTS "beforeQuantity" INTEGER;
ALTER TABLE "ImportBatchItem" ADD COLUMN IF NOT EXISTS "afterQuantity" INTEGER;

CREATE TABLE IF NOT EXISTS "ImportResolutionAttempt" (
  "id" TEXT NOT NULL,
  "importBatchItemId" TEXT NOT NULL,
  "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "mode" TEXT NOT NULL,
  "previousStatus" TEXT NOT NULL,
  "newStatus" TEXT NOT NULL,
  "resolutionMethod" TEXT NOT NULL,
  "confidence" TEXT NOT NULL,
  "queryUsed" TEXT,
  "message" TEXT,
  "matchedScryfallId" TEXT,
  "matchedCardPrintingId" TEXT,
  "candidatesJson" JSONB,
  "errorJson" JSONB,
  CONSTRAINT "ImportResolutionAttempt_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ImportResolutionAttempt" ADD CONSTRAINT "ImportResolutionAttempt_importBatchItemId_fkey" FOREIGN KEY ("importBatchItemId") REFERENCES "ImportBatchItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
