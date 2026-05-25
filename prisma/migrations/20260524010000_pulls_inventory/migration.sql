-- Card metadata expansion
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "oracleId" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "cmc" DOUBLE PRECISION;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "colors" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "setName" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "imageUris" JSONB;

-- CreateTable Pull
CREATE TABLE IF NOT EXISTS "Pull" (
  "id" TEXT NOT NULL,
  "roundId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "foil" BOOLEAN NOT NULL DEFAULT false,
  "condition" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Pull_pkey" PRIMARY KEY ("id")
);

-- CreateTable InventoryItem
CREATE TABLE IF NOT EXISTS "InventoryItem" (
  "id" TEXT NOT NULL,
  "currentOwnerId" TEXT NOT NULL,
  "originalOpenerId" TEXT NOT NULL,
  "cardId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL,
  "foil" BOOLEAN NOT NULL DEFAULT false,
  "condition" TEXT NOT NULL,
  "acquiredFromPullId" TEXT,
  "roundId" TEXT NOT NULL,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_currentOwnerId_originalOpenerId_cardId_foil_condition_roundId_key"
ON "InventoryItem"("currentOwnerId", "originalOpenerId", "cardId", "foil", "condition", "roundId");

-- Foreign keys
DO $$ BEGIN
ALTER TABLE "Pull" ADD CONSTRAINT "Pull_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "Pull" ADD CONSTRAINT "Pull_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "Pull" ADD CONSTRAINT "Pull_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_originalOpenerId_fkey" FOREIGN KEY ("originalOpenerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_acquiredFromPullId_fkey" FOREIGN KEY ("acquiredFromPullId") REFERENCES "Pull"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
