CREATE TYPE "CommercialPlanOrigin" AS ENUM (
  'annual_month',
  'standalone_exception',
  'legacy_unclassified'
);

ALTER TABLE "commercial_plans"
  ADD COLUMN "origin" "CommercialPlanOrigin" NOT NULL DEFAULT 'legacy_unclassified',
  ADD COLUMN "standalone_reason" TEXT;

ALTER TABLE "commercial_plans"
  ADD CONSTRAINT "commercial_plans_standalone_reason_check" CHECK (
    (
      "origin" = 'standalone_exception'
      AND "standalone_reason" IS NOT NULL
      AND char_length(btrim("standalone_reason")) >= 10
    )
    OR (
      "origin" <> 'standalone_exception'
      AND "standalone_reason" IS NULL
    )
  );

CREATE INDEX "commercial_plans_origin_idx" ON "commercial_plans"("origin");
