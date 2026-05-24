-- Ensure Card.manaValue exists for current Prisma schema.
ALTER TABLE "Card" ADD COLUMN IF NOT EXISTS "manaValue" DOUBLE PRECISION;

-- Backfill from legacy cmc column when present.
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
