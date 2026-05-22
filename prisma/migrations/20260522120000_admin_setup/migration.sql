-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "League"
  ADD COLUMN IF NOT EXISTS "description" TEXT,
  ADD COLUMN IF NOT EXISTS "appDisplayName" TEXT NOT NULL DEFAULT 'Box League';

-- AlterTable
ALTER TABLE "Season"
  ADD COLUMN IF NOT EXISTS "year" INTEGER NOT NULL DEFAULT 2026,
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Player"
  ADD COLUMN IF NOT EXISTS "name" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "isAdmin" BOOLEAN NOT NULL DEFAULT false;

-- Backfill name from displayName for existing rows
UPDATE "Player" SET "name" = lower(replace("displayName", ' ', '-')) WHERE "name" IS NULL;
ALTER TABLE "Player" ALTER COLUMN "name" SET NOT NULL;

-- CreateTable
CREATE TABLE IF NOT EXISTS "SetBox" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "setName" TEXT NOT NULL,
    "setCode" TEXT NOT NULL,
    "boxType" TEXT NOT NULL,
    "boxOwnerId" TEXT,
    "totalPacks" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "SetBox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PackAllocation" (
    "id" TEXT NOT NULL,
    "roundId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "packsAssigned" INTEGER NOT NULL,
    "packsOpened" INTEGER NOT NULL,
    "notes" TEXT,
    CONSTRAINT "PackAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "PointCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultValue" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "PointCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Player_name_key" ON "Player"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Round_seasonId_monthNumber_key" ON "Round"("seasonId", "monthNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PackAllocation_roundId_playerId_key" ON "PackAllocation"("roundId", "playerId");
CREATE UNIQUE INDEX IF NOT EXISTS "PointCategory_name_key" ON "PointCategory"("name");

-- Round table reshape from old month/year/label to new fields
ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "monthNumber" INTEGER;
ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);
ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);
ALTER TABLE "Round" ADD COLUMN IF NOT EXISTS "status" "RoundStatus" NOT NULL DEFAULT 'PLANNED';

UPDATE "Round" SET
  "name" = COALESCE("name", "label", 'Round'),
  "monthNumber" = COALESCE("monthNumber", "month", 1),
  "startDate" = COALESCE("startDate", make_timestamp("year", COALESCE("month",1), 1, 0, 0, 0)),
  "endDate" = COALESCE("endDate", make_timestamp("year", COALESCE("month",1), 28, 0, 0, 0))
WHERE "name" IS NULL OR "monthNumber" IS NULL OR "startDate" IS NULL;

ALTER TABLE "Round" ALTER COLUMN "name" SET NOT NULL;
ALTER TABLE "Round" ALTER COLUMN "monthNumber" SET NOT NULL;
ALTER TABLE "Round" ALTER COLUMN "startDate" SET NOT NULL;

-- Foreign keys
DO $$ BEGIN
ALTER TABLE "SetBox" ADD CONSTRAINT "SetBox_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
ALTER TABLE "SetBox" ADD CONSTRAINT "SetBox_boxOwnerId_fkey" FOREIGN KEY ("boxOwnerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
ALTER TABLE "PackAllocation" ADD CONSTRAINT "PackAllocation_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
ALTER TABLE "PackAllocation" ADD CONSTRAINT "PackAllocation_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
