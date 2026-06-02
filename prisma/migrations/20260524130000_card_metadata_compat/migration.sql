-- Compatibility migration: ensure all Card metadata columns expected by current Prisma schema exist.
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "manaValue" DOUBLE PRECISION;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "power" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "toughness" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "loyalty" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "defense" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "keywords" JSONB;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "legalities" JSONB;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "artist" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "purchaseUris" JSONB;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "scryfallUri" TEXT;
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "prices" JSONB;

-- Backfill manaValue from legacy cmc when available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Card'
      AND column_name = 'cmc'
  ) THEN
    EXECUTE 'UPDATE "Card" SET "manaValue" = COALESCE("manaValue", "cmc") WHERE "manaValue" IS NULL';
  END IF;
END $$;
