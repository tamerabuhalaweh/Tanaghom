CREATE TYPE "CommercialHierarchyLinkStatus" AS ENUM ('active', 'archived', 'superseded');

ALTER TABLE "commercial_plans"
  ADD COLUMN "superseded_by_plan_id" UUID,
  ADD COLUMN "superseded_at" TIMESTAMP(3),
  ADD COLUMN "superseded_reason" TEXT;

CREATE TABLE "commercial_plan_hierarchy_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "commercial_plan_id" UUID NOT NULL,
  "annual_plan_id" UUID NOT NULL,
  "monthly_portfolio_item_id" UUID NOT NULL,
  "status" "CommercialHierarchyLinkStatus" NOT NULL DEFAULT 'active',
  "period_exception_reason" TEXT,
  "exception_approved_by_user_id" UUID,
  "exception_approved_at" TIMESTAMP(3),
  "linked_by_user_id" UUID NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_plan_hierarchy_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_plan_hierarchy_exception_check" CHECK (
    ("period_exception_reason" IS NULL AND "exception_approved_by_user_id" IS NULL AND "exception_approved_at" IS NULL)
    OR
    (length(trim("period_exception_reason")) >= 3 AND "exception_approved_by_user_id" IS NOT NULL AND "exception_approved_at" IS NOT NULL)
  )
);

CREATE TABLE "commercial_plan_event_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "commercial_plan_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "status" "CommercialHierarchyLinkStatus" NOT NULL DEFAULT 'active',
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "period_exception_reason" TEXT,
  "exception_approved_by_user_id" UUID,
  "exception_approved_at" TIMESTAMP(3),
  "linked_by_user_id" UUID NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_plan_event_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_plan_event_links_exception_check" CHECK (
    ("period_exception_reason" IS NULL AND "exception_approved_by_user_id" IS NULL AND "exception_approved_at" IS NULL)
    OR
    (length(trim("period_exception_reason")) >= 3 AND "exception_approved_by_user_id" IS NOT NULL AND "exception_approved_at" IS NOT NULL)
  )
);

CREATE TABLE "commercial_plan_campaign_links" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "commercial_plan_id" UUID NOT NULL,
  "campaign_id" UUID NOT NULL,
  "status" "CommercialHierarchyLinkStatus" NOT NULL DEFAULT 'active',
  "period_exception_reason" TEXT,
  "exception_approved_by_user_id" UUID,
  "exception_approved_at" TIMESTAMP(3),
  "linked_by_user_id" UUID NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_plan_campaign_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "commercial_plan_campaign_links_exception_check" CHECK (
    ("period_exception_reason" IS NULL AND "exception_approved_by_user_id" IS NULL AND "exception_approved_at" IS NULL)
    OR
    (length(trim("period_exception_reason")) >= 3 AND "exception_approved_by_user_id" IS NOT NULL AND "exception_approved_at" IS NOT NULL)
  )
);

CREATE TABLE "commercial_plan_learning_influences" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "commercial_plan_id" UUID NOT NULL,
  "learning_set_id" UUID NOT NULL,
  "finding_id" UUID NOT NULL,
  "rationale" TEXT,
  "linked_by_user_id" UUID NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_plan_learning_influences_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commercial_plan_hierarchy_assignments_commercial_plan_id_key"
  ON "commercial_plan_hierarchy_assignments"("commercial_plan_id");
CREATE UNIQUE INDEX "commercial_plan_hierarchy_assignments_one_active_item_key"
  ON "commercial_plan_hierarchy_assignments"("monthly_portfolio_item_id") WHERE "status" = 'active';
CREATE INDEX "commercial_plan_hierarchy_assignments_tenant_key_idx"
  ON "commercial_plan_hierarchy_assignments"("tenant_key");
CREATE INDEX "commercial_plan_hierarchy_assignments_annual_plan_id_idx"
  ON "commercial_plan_hierarchy_assignments"("annual_plan_id");
CREATE INDEX "commercial_plan_hierarchy_assignments_monthly_portfolio_item_id_idx"
  ON "commercial_plan_hierarchy_assignments"("monthly_portfolio_item_id");
CREATE INDEX "commercial_plan_hierarchy_assignments_status_idx"
  ON "commercial_plan_hierarchy_assignments"("status");

CREATE UNIQUE INDEX "commercial_plan_event_links_commercial_plan_id_event_id_key"
  ON "commercial_plan_event_links"("commercial_plan_id", "event_id");
CREATE INDEX "commercial_plan_event_links_tenant_key_idx" ON "commercial_plan_event_links"("tenant_key");
CREATE INDEX "commercial_plan_event_links_event_id_idx" ON "commercial_plan_event_links"("event_id");
CREATE INDEX "commercial_plan_event_links_status_idx" ON "commercial_plan_event_links"("status");
CREATE UNIQUE INDEX "commercial_plan_event_links_one_primary_key"
  ON "commercial_plan_event_links"("commercial_plan_id") WHERE "status" = 'active' AND "is_primary" = true;
CREATE UNIQUE INDEX "commercial_plan_event_links_one_active_plan_per_event_key"
  ON "commercial_plan_event_links"("event_id") WHERE "status" = 'active';

CREATE UNIQUE INDEX "commercial_plan_campaign_links_commercial_plan_id_campaign_id_key"
  ON "commercial_plan_campaign_links"("commercial_plan_id", "campaign_id");
CREATE INDEX "commercial_plan_campaign_links_tenant_key_idx" ON "commercial_plan_campaign_links"("tenant_key");
CREATE INDEX "commercial_plan_campaign_links_campaign_id_idx" ON "commercial_plan_campaign_links"("campaign_id");
CREATE INDEX "commercial_plan_campaign_links_status_idx" ON "commercial_plan_campaign_links"("status");
CREATE UNIQUE INDEX "commercial_plan_campaign_links_one_active_plan_per_campaign_key"
  ON "commercial_plan_campaign_links"("campaign_id") WHERE "status" = 'active';

CREATE UNIQUE INDEX "commercial_plan_learning_influences_commercial_plan_id_finding_id_key"
  ON "commercial_plan_learning_influences"("commercial_plan_id", "finding_id");
CREATE INDEX "commercial_plan_learning_influences_tenant_key_idx"
  ON "commercial_plan_learning_influences"("tenant_key");
CREATE INDEX "commercial_plan_learning_influences_learning_set_id_idx"
  ON "commercial_plan_learning_influences"("learning_set_id");
CREATE INDEX "commercial_plan_learning_influences_finding_id_idx"
  ON "commercial_plan_learning_influences"("finding_id");
CREATE INDEX "commercial_plans_superseded_by_plan_id_idx" ON "commercial_plans"("superseded_by_plan_id");

ALTER TABLE "commercial_plans"
  ADD CONSTRAINT "commercial_plans_superseded_by_plan_id_fkey" FOREIGN KEY ("superseded_by_plan_id") REFERENCES "commercial_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_plan_hierarchy_assignments"
  ADD CONSTRAINT "commercial_plan_hierarchy_assignments_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_hierarchy_assignments_commercial_plan_id_fkey" FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_hierarchy_assignments_annual_plan_id_fkey" FOREIGN KEY ("annual_plan_id") REFERENCES "annual_commercial_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_hierarchy_assignments_monthly_portfolio_item_id_fkey" FOREIGN KEY ("monthly_portfolio_item_id") REFERENCES "monthly_portfolio_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_hierarchy_assignments_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_hierarchy_assignments_exception_approved_by_user_id_fkey" FOREIGN KEY ("exception_approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_plan_event_links"
  ADD CONSTRAINT "commercial_plan_event_links_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_event_links_commercial_plan_id_fkey" FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_event_links_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_event_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_event_links_exception_approved_by_user_id_fkey" FOREIGN KEY ("exception_approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_plan_campaign_links"
  ADD CONSTRAINT "commercial_plan_campaign_links_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_campaign_links_commercial_plan_id_fkey" FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_campaign_links_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "content_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_campaign_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_campaign_links_exception_approved_by_user_id_fkey" FOREIGN KEY ("exception_approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_plan_learning_influences"
  ADD CONSTRAINT "commercial_plan_learning_influences_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_learning_influences_commercial_plan_id_fkey" FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_learning_influences_learning_set_id_fkey" FOREIGN KEY ("learning_set_id") REFERENCES "commercial_learning_sets"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_learning_influences_finding_id_fkey" FOREIGN KEY ("finding_id") REFERENCES "commercial_historical_assessment_findings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "commercial_plan_learning_influences_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

WITH ranked AS (
  SELECT
    item."id" AS "monthly_item_id",
    item."commercial_plan_id",
    item."annual_plan_id",
    item."tenant_key",
    item."archived_at" AS "item_archived_at",
    plan."created_by_user_id",
    ROW_NUMBER() OVER (
      PARTITION BY item."commercial_plan_id"
      ORDER BY item."archived_at" NULLS FIRST, item."created_at", item."id"
    ) AS row_number
  FROM "monthly_portfolio_items" item
  JOIN "commercial_plans" plan ON plan."id" = item."commercial_plan_id"
  WHERE item."commercial_plan_id" IS NOT NULL
)
INSERT INTO "commercial_plan_hierarchy_assignments" (
  "tenant_key",
  "commercial_plan_id",
  "annual_plan_id",
  "monthly_portfolio_item_id",
  "status",
  "linked_by_user_id",
  "archived_at",
  "created_at",
  "updated_at"
)
SELECT
  "tenant_key",
  "commercial_plan_id",
  "annual_plan_id",
  "monthly_item_id",
  CASE
    WHEN "item_archived_at" IS NULL THEN 'active'::"CommercialHierarchyLinkStatus"
    ELSE 'archived'::"CommercialHierarchyLinkStatus"
  END,
  "created_by_user_id",
  "item_archived_at",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM ranked
WHERE row_number = 1;

WITH ranked_events AS (
  SELECT
    plan."tenant_key",
    plan."id",
    plan."linked_event_id",
    plan."created_by_user_id",
    ROW_NUMBER() OVER (
      PARTITION BY plan."linked_event_id"
      ORDER BY plan."created_at", plan."id"
    ) AS row_number
  FROM "commercial_plans" plan
  WHERE plan."linked_event_id" IS NOT NULL
)
INSERT INTO "commercial_plan_event_links" (
  "tenant_key",
  "commercial_plan_id",
  "event_id",
  "status",
  "is_primary",
  "linked_by_user_id",
  "archived_at",
  "created_at",
  "updated_at"
)
SELECT
  "tenant_key",
  "id",
  "linked_event_id",
  CASE
    WHEN row_number = 1 THEN 'active'::"CommercialHierarchyLinkStatus"
    ELSE 'archived'::"CommercialHierarchyLinkStatus"
  END,
  row_number = 1,
  "created_by_user_id",
  CASE WHEN row_number = 1 THEN NULL ELSE CURRENT_TIMESTAMP END,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM ranked_events
ON CONFLICT ("commercial_plan_id", "event_id") DO NOTHING;
