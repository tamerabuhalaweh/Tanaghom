-- Wave 1: historical commercial assessment and tenant-owned planning currency.
-- Existing commercial plan currency values are intentionally preserved.

CREATE TYPE "CommercialHistoricalAssessmentRunStatus" AS ENUM (
  'draft',
  'evidence_ready',
  'generating',
  'generated',
  'approved',
  'failed',
  'archived'
);

CREATE TYPE "CommercialHistoricalAssessmentEvidenceType" AS ENUM (
  'commercial_plan',
  'campaign',
  'event',
  'event_kpi',
  'lead_outcome',
  'event_problem',
  'assessment_signal',
  'connector_status'
);

CREATE TYPE "CommercialHistoricalAssessmentFindingType" AS ENUM (
  'repeat',
  'improve',
  'avoid',
  'investigate'
);

CREATE TYPE "CommercialHistoricalAssessmentFindingDecision" AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE "CommercialLearningSetStatus" AS ENUM ('active', 'archived');

ALTER TABLE "tenants"
  ADD COLUMN "default_currency" "CommercialCurrency" NOT NULL DEFAULT 'AED';

ALTER TABLE "commercial_plans"
  ALTER COLUMN "currency" SET DEFAULT 'AED';

CREATE TABLE "commercial_historical_assessment_runs" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "revenue_line_id" UUID,
  "event_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "campaign_ids" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "audience_query" TEXT,
  "channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "title" TEXT NOT NULL,
  "date_from" TIMESTAMP(3) NOT NULL,
  "date_to" TIMESTAMP(3) NOT NULL,
  "status" "CommercialHistoricalAssessmentRunStatus" NOT NULL DEFAULT 'draft',
  "evidence_summary" JSONB,
  "missing_data" JSONB,
  "provider_type" TEXT,
  "provider_model" TEXT,
  "prompt_version" TEXT NOT NULL DEFAULT 'commercial-historical-assessment.v1',
  "requested_by_user_id" UUID NOT NULL,
  "generated_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "failure_reason" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commercial_historical_assessment_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commercial_historical_assessment_evidence" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "assessment_run_id" UUID NOT NULL,
  "evidence_type" "CommercialHistoricalAssessmentEvidenceType" NOT NULL,
  "source_object_type" TEXT NOT NULL,
  "source_object_id" TEXT NOT NULL,
  "source_name" TEXT,
  "metric_key" TEXT NOT NULL,
  "metric_value" DECIMAL(16,4),
  "metric_unit" TEXT,
  "observed_at" TIMESTAMP(3),
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "commercial_historical_assessment_evidence_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commercial_learning_sets" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "assessment_run_id" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "status" "CommercialLearningSetStatus" NOT NULL DEFAULT 'active',
  "approved_by_user_id" UUID NOT NULL,
  "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commercial_learning_sets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "commercial_historical_assessment_findings" (
  "id" UUID NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "assessment_run_id" UUID NOT NULL,
  "learning_set_id" UUID,
  "finding_type" "CommercialHistoricalAssessmentFindingType" NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "recommendation" TEXT NOT NULL,
  "confidence" DECIMAL(5,4) NOT NULL,
  "evidence_ids" TEXT[] NOT NULL,
  "decision" "CommercialHistoricalAssessmentFindingDecision" NOT NULL DEFAULT 'pending',
  "decision_reason" TEXT,
  "decided_by_user_id" UUID,
  "decided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "commercial_historical_assessment_findings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "commercial_historical_assessment_evidence_run_type_source_metric_key"
  ON "commercial_historical_assessment_evidence"("assessment_run_id", "evidence_type", "source_object_type", "source_object_id", "metric_key");
CREATE UNIQUE INDEX "commercial_learning_sets_assessment_run_id_key"
  ON "commercial_learning_sets"("assessment_run_id");

CREATE INDEX "commercial_historical_assessment_runs_tenant_key_idx" ON "commercial_historical_assessment_runs"("tenant_key");
CREATE INDEX "commercial_historical_assessment_runs_revenue_line_id_idx" ON "commercial_historical_assessment_runs"("revenue_line_id");
CREATE INDEX "commercial_historical_assessment_runs_status_idx" ON "commercial_historical_assessment_runs"("status");
CREATE INDEX "commercial_historical_assessment_runs_date_range_idx" ON "commercial_historical_assessment_runs"("date_from", "date_to");
CREATE INDEX "commercial_historical_assessment_runs_requested_by_idx" ON "commercial_historical_assessment_runs"("requested_by_user_id");
CREATE INDEX "commercial_historical_assessment_evidence_tenant_key_idx" ON "commercial_historical_assessment_evidence"("tenant_key");
CREATE INDEX "commercial_historical_assessment_evidence_run_idx" ON "commercial_historical_assessment_evidence"("assessment_run_id");
CREATE INDEX "commercial_historical_assessment_evidence_type_idx" ON "commercial_historical_assessment_evidence"("evidence_type");
CREATE INDEX "commercial_historical_assessment_evidence_source_idx" ON "commercial_historical_assessment_evidence"("source_object_type", "source_object_id");
CREATE INDEX "commercial_historical_assessment_findings_tenant_key_idx" ON "commercial_historical_assessment_findings"("tenant_key");
CREATE INDEX "commercial_historical_assessment_findings_run_idx" ON "commercial_historical_assessment_findings"("assessment_run_id");
CREATE INDEX "commercial_historical_assessment_findings_learning_set_idx" ON "commercial_historical_assessment_findings"("learning_set_id");
CREATE INDEX "commercial_historical_assessment_findings_type_idx" ON "commercial_historical_assessment_findings"("finding_type");
CREATE INDEX "commercial_historical_assessment_findings_decision_idx" ON "commercial_historical_assessment_findings"("decision");
CREATE INDEX "commercial_historical_assessment_findings_decided_by_idx" ON "commercial_historical_assessment_findings"("decided_by_user_id");
CREATE INDEX "commercial_learning_sets_tenant_key_idx" ON "commercial_learning_sets"("tenant_key");
CREATE INDEX "commercial_learning_sets_status_idx" ON "commercial_learning_sets"("status");
CREATE INDEX "commercial_learning_sets_approved_by_idx" ON "commercial_learning_sets"("approved_by_user_id");

ALTER TABLE "commercial_historical_assessment_runs"
  ADD CONSTRAINT "commercial_historical_assessment_runs_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_runs"
  ADD CONSTRAINT "commercial_historical_assessment_runs_revenue_line_id_fkey"
  FOREIGN KEY ("revenue_line_id") REFERENCES "commercial_revenue_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_runs"
  ADD CONSTRAINT "commercial_historical_assessment_runs_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_evidence"
  ADD CONSTRAINT "commercial_historical_assessment_evidence_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_evidence"
  ADD CONSTRAINT "commercial_historical_assessment_evidence_assessment_run_id_fkey"
  FOREIGN KEY ("assessment_run_id") REFERENCES "commercial_historical_assessment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_learning_sets"
  ADD CONSTRAINT "commercial_learning_sets_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_learning_sets"
  ADD CONSTRAINT "commercial_learning_sets_assessment_run_id_fkey"
  FOREIGN KEY ("assessment_run_id") REFERENCES "commercial_historical_assessment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_learning_sets"
  ADD CONSTRAINT "commercial_learning_sets_approved_by_user_id_fkey"
  FOREIGN KEY ("approved_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_findings"
  ADD CONSTRAINT "commercial_historical_assessment_findings_tenant_key_fkey"
  FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_findings"
  ADD CONSTRAINT "commercial_historical_assessment_findings_assessment_run_id_fkey"
  FOREIGN KEY ("assessment_run_id") REFERENCES "commercial_historical_assessment_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_findings"
  ADD CONSTRAINT "commercial_historical_assessment_findings_learning_set_id_fkey"
  FOREIGN KEY ("learning_set_id") REFERENCES "commercial_learning_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "commercial_historical_assessment_findings"
  ADD CONSTRAINT "commercial_historical_assessment_findings_decided_by_user_id_fkey"
  FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
