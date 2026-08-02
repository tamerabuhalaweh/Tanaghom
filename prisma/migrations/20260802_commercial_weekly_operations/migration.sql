ALTER TABLE "tenants"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Dubai';

CREATE TYPE "CommercialWeeklyWorkStatus" AS ENUM (
  'planned',
  'ready',
  'in_progress',
  'blocked',
  'awaiting_approval',
  'completed',
  'cancelled'
);

CREATE TYPE "CommercialWeeklyWorkPriority" AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

CREATE TYPE "CommercialWeeklyWorkLinkType" AS ENUM (
  'content_item',
  'campaign',
  'event',
  'lead',
  'discipline_record',
  'connector_evidence'
);

CREATE TABLE "commercial_weekly_work_items" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "commercial_plan_id" UUID NOT NULL,
  "week_start_date" DATE NOT NULL,
  "title" TEXT NOT NULL,
  "business_outcome" TEXT NOT NULL,
  "owner_user_id" UUID,
  "owner_role" TEXT,
  "start_date" DATE,
  "due_date" DATE,
  "status" "CommercialWeeklyWorkStatus" NOT NULL DEFAULT 'planned',
  "priority" "CommercialWeeklyWorkPriority" NOT NULL DEFAULT 'medium',
  "budget_guardrail" DECIMAL(12, 2),
  "currency" "CommercialCurrency" NOT NULL DEFAULT 'AED',
  "link_type" "CommercialWeeklyWorkLinkType",
  "link_object_id" TEXT,
  "link_label" TEXT,
  "blocker_reason" TEXT,
  "completion_evidence" TEXT,
  "revision" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "approved_by_user_id" UUID,
  "approved_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "cancelled_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "commercial_weekly_work_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "commercial_weekly_work_items_tenant_key_idx"
ON "commercial_weekly_work_items"("tenant_key");

CREATE INDEX "commercial_weekly_work_items_commercial_plan_id_week_start_date_idx"
ON "commercial_weekly_work_items"("commercial_plan_id", "week_start_date");

CREATE INDEX "commercial_weekly_work_items_owner_user_id_idx"
ON "commercial_weekly_work_items"("owner_user_id");

CREATE INDEX "commercial_weekly_work_items_status_idx"
ON "commercial_weekly_work_items"("status");

CREATE INDEX "commercial_weekly_work_items_priority_idx"
ON "commercial_weekly_work_items"("priority");

CREATE INDEX "commercial_weekly_work_items_due_date_idx"
ON "commercial_weekly_work_items"("due_date");

CREATE INDEX "commercial_weekly_work_items_link_type_link_object_id_idx"
ON "commercial_weekly_work_items"("link_type", "link_object_id");

ALTER TABLE "commercial_weekly_work_items"
ADD CONSTRAINT "commercial_weekly_work_items_tenant_key_fkey"
FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_weekly_work_items"
ADD CONSTRAINT "commercial_weekly_work_items_commercial_plan_id_fkey"
FOREIGN KEY ("commercial_plan_id") REFERENCES "commercial_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "commercial_weekly_work_items"
ADD CONSTRAINT "commercial_weekly_work_items_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "commercial_weekly_work_items"
ADD CONSTRAINT "commercial_weekly_work_items_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "commercial_weekly_work_items"
ADD CONSTRAINT "commercial_weekly_work_items_approved_by_user_id_fkey"
FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
