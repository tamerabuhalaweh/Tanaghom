-- CreateEnum
CREATE TYPE "AnalyticsSourceStatus" AS ENUM ('active', 'inactive', 'planned', 'suspended');

-- CreateEnum
CREATE TYPE "IngestionRequestStatus" AS ENUM ('pending', 'validating', 'ingesting', 'completed', 'blocked', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('draft', 'generated', 'reviewed', 'published', 'archived');

-- CreateEnum
CREATE TYPE "PeriodType" AS ENUM ('h24', 'h48', 'd7', 'weekly', 'monthly', 'custom');

-- CreateTable
CREATE TABLE "analytics_sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "source_type" TEXT NOT NULL,
    "status" "AnalyticsSourceStatus" NOT NULL DEFAULT 'planned',
    "mcp_connector_id" UUID,
    "requires_mcp" BOOLEAN NOT NULL DEFAULT true,
    "supports_read" BOOLEAN NOT NULL DEFAULT true,
    "supports_write" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_ingestion_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_id" UUID NOT NULL,
    "campaign_id" UUID,
    "content_item_id" UUID,
    "publishing_package_id" UUID,
    "postiz_publishing_job_id" UUID,
    "platform" TEXT,
    "requested_by_user_id" UUID NOT NULL,
    "requested_by_agent_rep_id" UUID NOT NULL,
    "mcp_mediation_request_id" UUID,
    "status" "IngestionRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "blocked_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "analytics_ingestion_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_metric_mappings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "source_metric_name" TEXT NOT NULL,
    "normalized_metric_name" TEXT NOT NULL,
    "mapping_rule" JSONB,
    "confidence" TEXT NOT NULL DEFAULT 'medium',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_metric_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_periods" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_type" "PeriodType" NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_performance_reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "reporting_period_id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "generated_by_user_id" UUID NOT NULL,
    "generated_by_agent_rep_id" UUID NOT NULL,
    "report_status" "ReportStatus" NOT NULL DEFAULT 'draft',
    "summary" TEXT,
    "top_findings" JSONB,
    "risks" JSONB,
    "recommendations" JSONB,
    "linked_learning_signal_ids" TEXT[],
    "linked_saif_decision_record_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaign_performance_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "analytics_sources_name_key" ON "analytics_sources"("name");

-- CreateIndex
CREATE INDEX "analytics_sources_status_idx" ON "analytics_sources"("status");

-- CreateIndex
CREATE INDEX "analytics_sources_source_type_idx" ON "analytics_sources"("source_type");

-- CreateIndex
CREATE INDEX "analytics_ingestion_requests_source_id_idx" ON "analytics_ingestion_requests"("source_id");

-- CreateIndex
CREATE INDEX "analytics_ingestion_requests_status_idx" ON "analytics_ingestion_requests"("status");

-- CreateIndex
CREATE INDEX "analytics_ingestion_requests_campaign_id_idx" ON "analytics_ingestion_requests"("campaign_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_source_id_idx" ON "analytics_snapshots"("source_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_campaign_id_idx" ON "analytics_snapshots"("campaign_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_content_item_id_idx" ON "analytics_snapshots"("content_item_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_collected_at_idx" ON "analytics_snapshots"("collected_at");

-- CreateIndex
CREATE INDEX "platform_metric_mappings_platform_idx" ON "platform_metric_mappings"("platform");

-- CreateIndex
CREATE UNIQUE INDEX "platform_metric_mappings_platform_source_metric_name_key" ON "platform_metric_mappings"("platform", "source_metric_name");

-- CreateIndex
CREATE INDEX "reporting_periods_period_type_idx" ON "reporting_periods"("period_type");

-- CreateIndex
CREATE INDEX "reporting_periods_start_date_end_date_idx" ON "reporting_periods"("start_date", "end_date");

-- CreateIndex
CREATE INDEX "campaign_performance_reports_reporting_period_id_idx" ON "campaign_performance_reports"("reporting_period_id");

-- CreateIndex
CREATE INDEX "campaign_performance_reports_campaign_id_idx" ON "campaign_performance_reports"("campaign_id");

-- CreateIndex
CREATE INDEX "campaign_performance_reports_report_status_idx" ON "campaign_performance_reports"("report_status");

-- AddForeignKey
ALTER TABLE "analytics_ingestion_requests" ADD CONSTRAINT "analytics_ingestion_requests_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "analytics_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "analytics_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_ingestion_request_id_fkey" FOREIGN KEY ("ingestion_request_id") REFERENCES "analytics_ingestion_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_performance_reports" ADD CONSTRAINT "campaign_performance_reports_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
