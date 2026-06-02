DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('PLAYER', 'ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "email" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "displayName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "role" "UserRole" NOT NULL DEFAULT 'PLAYER';
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "forcePasswordChange" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "User" SET "displayName" = "username" WHERE "displayName" IS NULL;
ALTER TABLE "User" ALTER COLUMN "displayName" SET NOT NULL;

DO $$ BEGIN
  CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

UPDATE "User"
SET "role" = 'ADMIN'::"UserRole"
WHERE "username" = COALESCE(current_setting('app.admin_username', true), 'admin') OR "username" = 'admin';
