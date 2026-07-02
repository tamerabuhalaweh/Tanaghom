-- CreateEnum
CREATE TYPE "CommercialEventType" AS ENUM ('tagyeer_wa_irtaqi', 'moaaskar_al_tamayoz', 'business_camp', 'virtual_event');

-- CreateEnum
CREATE TYPE "CommercialEventStatus" AS ENUM ('draft', 'planning', 'active', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "commercial_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "event_type" "CommercialEventType" NOT NULL,
    "event_date" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "campaign_start_date" TIMESTAMP(3),
    "campaign_end_date" TIMESTAMP(3),
    "expected_attendance" INTEGER,
    "revenue_target" DECIMAL(12,2),
    "planned_budget" DECIMAL(12,2),
    "owner_user_id" UUID NOT NULL,
    "status" "CommercialEventStatus" NOT NULL DEFAULT 'draft',
    "offer" TEXT,
    "audience" TEXT,
    "geography" TEXT,
    "fomo_angle" TEXT,
    "upsell_plan" TEXT,
    "selected_channels" TEXT[],
    "content_department_requirements" TEXT,
    "sales_team_requirements" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commercial_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commercial_events_tenant_key_idx" ON "commercial_events"("tenant_key");
CREATE INDEX "commercial_events_event_type_idx" ON "commercial_events"("event_type");
CREATE INDEX "commercial_events_status_idx" ON "commercial_events"("status");
CREATE INDEX "commercial_events_owner_user_id_idx" ON "commercial_events"("owner_user_id");
CREATE INDEX "commercial_events_event_date_idx" ON "commercial_events"("event_date");

-- AddForeignKey
ALTER TABLE "commercial_events" ADD CONSTRAINT "commercial_events_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "commercial_events" ADD CONSTRAINT "commercial_events_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add event_id to content_requests
ALTER TABLE "content_requests" ADD COLUMN "event_id" UUID;
CREATE INDEX "content_requests_event_id_idx" ON "content_requests"("event_id");
ALTER TABLE "content_requests" ADD CONSTRAINT "content_requests_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add event_id to lead_capture_records
ALTER TABLE "lead_capture_records" ADD COLUMN "event_id" UUID;
CREATE INDEX "lead_capture_records_event_id_idx" ON "lead_capture_records"("event_id");
ALTER TABLE "lead_capture_records" ADD CONSTRAINT "lead_capture_records_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AlterTable: Add event_id to publishing_packages
ALTER TABLE "publishing_packages" ADD COLUMN "event_id" UUID;
CREATE INDEX "publishing_packages_event_id_idx" ON "publishing_packages"("event_id");
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE SET NULL ON UPDATE CASCADE;
