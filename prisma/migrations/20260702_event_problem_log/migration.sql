-- CreateEnum
CREATE TYPE "ProblemCategory" AS ENUM ('content', 'ads', 'audience', 'funnel', 'sales', 'budget', 'operations', 'integration', 'other');

-- CreateEnum
CREATE TYPE "ProblemSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ProblemStatus" AS ENUM ('open', 'investigating', 'resolved', 'dismissed');

-- CreateEnum
CREATE TYPE "ProblemSource" AS ENUM ('manual', 'kpi_review', 'lead_review', 'sales_feedback', 'campaign_review', 'integration_check');

-- CreateTable
CREATE TABLE "event_problems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "ProblemCategory" NOT NULL,
    "severity" "ProblemSeverity" NOT NULL DEFAULT 'medium',
    "status" "ProblemStatus" NOT NULL DEFAULT 'open',
    "source" "ProblemSource" NOT NULL DEFAULT 'manual',
    "impact_summary" TEXT,
    "recommended_action" TEXT,
    "owner_role" TEXT,
    "related_lead_id" UUID,
    "related_campaign_id" UUID,
    "due_date" TIMESTAMP(3),
    "resolution_notes" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "resolved_by_user_id" UUID,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_problems_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_problems_tenant_key_idx" ON "event_problems"("tenant_key");
CREATE INDEX "event_problems_event_id_idx" ON "event_problems"("event_id");
CREATE INDEX "event_problems_status_idx" ON "event_problems"("status");
CREATE INDEX "event_problems_severity_idx" ON "event_problems"("severity");
CREATE INDEX "event_problems_category_idx" ON "event_problems"("category");
CREATE INDEX "event_problems_created_by_user_id_idx" ON "event_problems"("created_by_user_id");

ALTER TABLE "event_problems" ADD CONSTRAINT "event_problems_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_problems" ADD CONSTRAINT "event_problems_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_problems" ADD CONSTRAINT "event_problems_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_problems" ADD CONSTRAINT "event_problems_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
