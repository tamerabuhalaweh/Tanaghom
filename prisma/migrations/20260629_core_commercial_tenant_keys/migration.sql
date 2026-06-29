INSERT INTO "tenants" ("tenant_key", "name", "status")
VALUES ('default', 'Tanaghum Default Tenant', 'active'::"TenantStatus")
ON CONFLICT ("tenant_key") DO NOTHING;

ALTER TABLE "content_requests" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "content_items" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "approvals" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "publishing_packages" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "analytics_ingestion_requests" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "analytics_snapshots" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "campaign_performance_reports" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';
ALTER TABLE "lead_capture_records" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';

UPDATE "content_requests" cr
SET "tenant_key" = u."tenant_key"
FROM "users" u
WHERE cr."requester_id" = u."id";

UPDATE "content_items" ci
SET "tenant_key" = cr."tenant_key"
FROM "content_requests" cr
WHERE ci."request_id" = cr."id";

UPDATE "approvals" a
SET "tenant_key" = u."tenant_key"
FROM "users" u
WHERE a."requester_user_id" = u."id";

UPDATE "publishing_packages" pp
SET "tenant_key" = u."tenant_key"
FROM "users" u
WHERE pp."created_by_user_id" = u."id";

UPDATE "analytics_ingestion_requests" air
SET "tenant_key" = u."tenant_key"
FROM "users" u
WHERE air."requested_by_user_id" = u."id";

UPDATE "analytics_snapshots" s
SET "tenant_key" = air."tenant_key"
FROM "analytics_ingestion_requests" air
WHERE s."ingestion_request_id" = air."id";

UPDATE "analytics_snapshots" s
SET "tenant_key" = cr."tenant_key"
FROM "content_requests" cr
WHERE s."campaign_id" = cr."id"
  AND s."tenant_key" = 'default';

UPDATE "analytics_snapshots" s
SET "tenant_key" = ci."tenant_key"
FROM "content_items" ci
WHERE s."content_item_id" = ci."id"
  AND s."tenant_key" = 'default';

UPDATE "analytics_snapshots" s
SET "tenant_key" = pp."tenant_key"
FROM "publishing_packages" pp
WHERE s."publishing_package_id" = pp."id"
  AND s."tenant_key" = 'default';

UPDATE "campaign_performance_reports" cpr
SET "tenant_key" = u."tenant_key"
FROM "users" u
WHERE cpr."generated_by_user_id" = u."id";

UPDATE "campaign_performance_reports" cpr
SET "tenant_key" = cr."tenant_key"
FROM "content_requests" cr
WHERE cpr."campaign_id" = cr."id"
  AND cpr."tenant_key" = 'default';

UPDATE "lead_capture_records" lcr
SET "tenant_key" = u."tenant_key"
FROM "users" u
WHERE lcr."created_by_user_id" = u."id";

CREATE INDEX IF NOT EXISTS "content_requests_tenant_key_idx" ON "content_requests"("tenant_key");
CREATE INDEX IF NOT EXISTS "content_items_tenant_key_idx" ON "content_items"("tenant_key");
CREATE INDEX IF NOT EXISTS "approvals_tenant_key_idx" ON "approvals"("tenant_key");
CREATE INDEX IF NOT EXISTS "publishing_packages_tenant_key_idx" ON "publishing_packages"("tenant_key");
CREATE INDEX IF NOT EXISTS "analytics_ingestion_requests_tenant_key_idx" ON "analytics_ingestion_requests"("tenant_key");
CREATE INDEX IF NOT EXISTS "analytics_snapshots_tenant_key_idx" ON "analytics_snapshots"("tenant_key");
CREATE INDEX IF NOT EXISTS "campaign_performance_reports_tenant_key_idx" ON "campaign_performance_reports"("tenant_key");
CREATE INDEX IF NOT EXISTS "lead_capture_records_tenant_key_idx" ON "lead_capture_records"("tenant_key");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_requests_tenant_key_fkey') THEN
    ALTER TABLE "content_requests"
      ADD CONSTRAINT "content_requests_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'content_items_tenant_key_fkey') THEN
    ALTER TABLE "content_items"
      ADD CONSTRAINT "content_items_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'approvals_tenant_key_fkey') THEN
    ALTER TABLE "approvals"
      ADD CONSTRAINT "approvals_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publishing_packages_tenant_key_fkey') THEN
    ALTER TABLE "publishing_packages"
      ADD CONSTRAINT "publishing_packages_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_ingestion_requests_tenant_key_fkey') THEN
    ALTER TABLE "analytics_ingestion_requests"
      ADD CONSTRAINT "analytics_ingestion_requests_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'analytics_snapshots_tenant_key_fkey') THEN
    ALTER TABLE "analytics_snapshots"
      ADD CONSTRAINT "analytics_snapshots_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'campaign_performance_reports_tenant_key_fkey') THEN
    ALTER TABLE "campaign_performance_reports"
      ADD CONSTRAINT "campaign_performance_reports_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'lead_capture_records_tenant_key_fkey') THEN
    ALTER TABLE "lead_capture_records"
      ADD CONSTRAINT "lead_capture_records_tenant_key_fkey"
      FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
