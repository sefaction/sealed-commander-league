DO $$ BEGIN
  CREATE TYPE "FoilStatus" AS ENUM ('NONFOIL', 'FOIL', 'ETCHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InventorySourceType" AS ENUM ('PULL', 'TRADE', 'MANUAL', 'CORRECTION', 'PRIZE', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "foilStatus" "FoilStatus" NOT NULL DEFAULT 'NONFOIL';
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "sourceType" "InventorySourceType" NOT NULL DEFAULT 'PULL';

UPDATE "InventoryItem" SET "foilStatus" = CASE WHEN "foil" = true THEN 'FOIL'::"FoilStatus" ELSE 'NONFOIL'::"FoilStatus" END WHERE "foilStatus" = 'NONFOIL';

CREATE TABLE IF NOT EXISTS "InventoryAuditLog" (
  "id" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "changedByUserId" TEXT,
  "changeType" TEXT NOT NULL,
  "beforeJson" JSONB NOT NULL,
  "afterJson" JSONB NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryAuditLog_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "InventoryAuditLog" ADD CONSTRAINT "InventoryAuditLog_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryAuditLog" ADD CONSTRAINT "InventoryAuditLog_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
