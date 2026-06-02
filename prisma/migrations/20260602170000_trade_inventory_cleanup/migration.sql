ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "offeredSnapshotJson" JSONB;
ALTER TABLE "Trade" ADD COLUMN IF NOT EXISTS "requestedSnapshotJson" JSONB;

ALTER TABLE "Trade" DROP CONSTRAINT IF EXISTS "Trade_offeredInventoryItemId_fkey";
ALTER TABLE "Trade" DROP CONSTRAINT IF EXISTS "Trade_requestedInventoryItemId_fkey";
ALTER TABLE "Trade" ALTER COLUMN "offeredInventoryItemId" DROP NOT NULL;
ALTER TABLE "Trade" ALTER COLUMN "requestedInventoryItemId" DROP NOT NULL;
DO $$ BEGIN ALTER TABLE "Trade" ADD CONSTRAINT "Trade_offeredInventoryItemId_fkey" FOREIGN KEY ("offeredInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "Trade" ADD CONSTRAINT "Trade_requestedInventoryItemId_fkey" FOREIGN KEY ("requestedInventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "InventoryAuditLog" DROP CONSTRAINT IF EXISTS "InventoryAuditLog_inventoryItemId_fkey";
ALTER TABLE "InventoryAuditLog" ALTER COLUMN "inventoryItemId" DROP NOT NULL;
DO $$ BEGIN ALTER TABLE "InventoryAuditLog" ADD CONSTRAINT "InventoryAuditLog_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
