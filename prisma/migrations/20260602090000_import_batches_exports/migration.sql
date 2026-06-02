ALTER TYPE "InventorySourceType" ADD VALUE IF NOT EXISTS 'CSV_PULL_IMPORT';
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "language" TEXT NOT NULL DEFAULT 'EN';

CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id" TEXT NOT NULL,
  "importType" TEXT NOT NULL,
  "filename" TEXT NOT NULL,
  "selectedPlayerId" TEXT NOT NULL,
  "selectedOriginalOpenerId" TEXT NOT NULL,
  "selectedRoundId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "matchedRows" INTEGER NOT NULL DEFAULT 0,
  "skippedRows" INTEGER NOT NULL DEFAULT 0,
  "warningRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdByUserId" TEXT,
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ImportBatchItem" (
  "id" TEXT NOT NULL,
  "importBatchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "rawRowJson" JSONB NOT NULL,
  "parsedRowJson" JSONB NOT NULL,
  "status" TEXT NOT NULL,
  "message" TEXT,
  "inventoryItemId" TEXT,
  "pullId" TEXT,
  "cardPrintingId" TEXT,
  "parsedFoilStatus" TEXT,
  "parsedCondition" TEXT,
  CONSTRAINT "ImportBatchItem_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_selectedPlayerId_fkey" FOREIGN KEY ("selectedPlayerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_selectedOriginalOpenerId_fkey" FOREIGN KEY ("selectedOriginalOpenerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_selectedRoundId_fkey" FOREIGN KEY ("selectedRoundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ImportBatchItem" ADD CONSTRAINT "ImportBatchItem_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "ImportBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ImportBatchItem" ADD CONSTRAINT "ImportBatchItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ImportBatchItem" ADD CONSTRAINT "ImportBatchItem_pullId_fkey" FOREIGN KEY ("pullId") REFERENCES "Pull"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "ImportBatchItem" ADD CONSTRAINT "ImportBatchItem_cardPrintingId_fkey" FOREIGN KEY ("cardPrintingId") REFERENCES "Card"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
