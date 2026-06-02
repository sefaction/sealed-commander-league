-- Run after 20260602150000_trades_system commits the expanded TradeStatus enum values.
ALTER TABLE "Trade" ALTER COLUMN "status" SET DEFAULT 'PROPOSED';
