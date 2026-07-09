ALTER TYPE "CommercialRevenueLineType" ADD VALUE IF NOT EXISTS 'book';
ALTER TYPE "CommercialRevenueLineType" ADD VALUE IF NOT EXISTS 'merchandise';

DO $$ BEGIN
  CREATE TYPE "CommercialCurrency" AS ENUM ('USD', 'AED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "commercial_plans"
  ADD COLUMN IF NOT EXISTS "currency" "CommercialCurrency" NOT NULL DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS "commercial_plans_currency_idx" ON "commercial_plans"("currency");
