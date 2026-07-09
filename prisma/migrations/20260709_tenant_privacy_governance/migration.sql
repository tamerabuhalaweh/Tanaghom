ALTER TABLE "tenants"
  ADD COLUMN IF NOT EXISTS "privacy_policy" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "privacy_review_status" TEXT NOT NULL DEFAULT 'pending_customer_legal_review',
  ADD COLUMN IF NOT EXISTS "privacy_review_updated_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "privacy_review_updated_by_user_id" UUID;

CREATE INDEX IF NOT EXISTS "tenants_privacy_review_status_idx"
  ON "tenants"("privacy_review_status");
