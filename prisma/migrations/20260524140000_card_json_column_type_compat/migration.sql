-- Normalize legacy Card array/json column types to match current Prisma Json fields.
-- Older migrations created "colors" as TEXT[] which Prisma cannot decode as Json.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Card'
      AND column_name = 'colors'
      AND data_type = 'ARRAY'
      AND udt_name = '_text'
  ) THEN
    ALTER TABLE "Card" ALTER COLUMN "colors" DROP DEFAULT;
    ALTER TABLE "Card"
      ALTER COLUMN "colors" TYPE JSONB
      USING to_jsonb("colors");
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Card'
      AND column_name = 'colorIdentity'
      AND data_type = 'ARRAY'
      AND udt_name = '_text'
  ) THEN
    ALTER TABLE "Card" ALTER COLUMN "colorIdentity" DROP DEFAULT;
    ALTER TABLE "Card"
      ALTER COLUMN "colorIdentity" TYPE JSONB
      USING to_jsonb("colorIdentity");
  END IF;
END $$;
