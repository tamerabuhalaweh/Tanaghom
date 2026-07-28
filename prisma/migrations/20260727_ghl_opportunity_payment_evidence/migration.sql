ALTER TABLE "lead_capture_records"
  ADD COLUMN "payment_date" TIMESTAMP(3);

ALTER TABLE "ghl_plan_attribution_mappings"
  ADD COLUMN "payment_date_field" TEXT;

CREATE INDEX "lead_capture_records_payment_date_idx"
  ON "lead_capture_records"("payment_date");
