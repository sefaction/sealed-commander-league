-- CreateSchema
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED');

CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "passwordHash" TEXT NOT NULL,
  "playerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "League" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Season" (
  "id" TEXT PRIMARY KEY,
  "leagueId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "startDate" TIMESTAMP(3) NOT NULL,
  "endDate" TIMESTAMP(3),
  UNIQUE("leagueId", "name")
);

CREATE TABLE "Player" (
  "id" TEXT PRIMARY KEY,
  "displayName" TEXT NOT NULL UNIQUE
);

CREATE TABLE "LeaguePlayer" (
  "id" TEXT PRIMARY KEY,
  "seasonId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  UNIQUE("seasonId", "playerId")
);

CREATE TABLE "Round" (
  "id" TEXT PRIMARY KEY,
  "seasonId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "label" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("seasonId", "month", "year")
);

CREATE TABLE "Card" (
  "id" TEXT PRIMARY KEY,
  "scryfallId" TEXT NOT NULL UNIQUE,
  "name" TEXT NOT NULL,
  "manaCost" TEXT,
  "colorIdentity" TEXT[] NOT NULL,
  "typeLine" TEXT NOT NULL,
  "oracleText" TEXT,
  "setCode" TEXT NOT NULL,
  "collectorNumber" TEXT NOT NULL,
  "rarity" TEXT NOT NULL,
  "imageUri" TEXT
);

CREATE TABLE "CardOwnership" (
  "id" TEXT PRIMARY KEY,
  "cardId" TEXT NOT NULL,
  "originalOpenerId" TEXT NOT NULL,
  "currentOwnerId" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE "PointEvent" (
  "id" TEXT PRIMARY KEY,
  "roundId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "points" INTEGER NOT NULL
);

ALTER TABLE "User" ADD CONSTRAINT "User_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE SET NULL;
ALTER TABLE "Season" ADD CONSTRAINT "Season_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT;
ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT;
ALTER TABLE "LeaguePlayer" ADD CONSTRAINT "LeaguePlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT;
ALTER TABLE "Round" ADD CONSTRAINT "Round_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT;
ALTER TABLE "CardOwnership" ADD CONSTRAINT "CardOwnership_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Card"("id") ON DELETE RESTRICT;
ALTER TABLE "CardOwnership" ADD CONSTRAINT "CardOwnership_originalOpenerId_fkey" FOREIGN KEY ("originalOpenerId") REFERENCES "Player"("id") ON DELETE RESTRICT;
ALTER TABLE "CardOwnership" ADD CONSTRAINT "CardOwnership_currentOwnerId_fkey" FOREIGN KEY ("currentOwnerId") REFERENCES "Player"("id") ON DELETE RESTRICT;
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "Round"("id") ON DELETE RESTRICT;
ALTER TABLE "PointEvent" ADD CONSTRAINT "PointEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT;
