-- AlterEnum: Add new values to LeadStatus
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'meeting_booked';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'meeting_attended';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'no_show';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'purchased';
ALTER TYPE "LeadStatus" ADD VALUE IF NOT EXISTS 'follow_up_needed';

-- CreateEnum: LeadTemperature
CREATE TYPE "LeadTemperature" AS ENUM ('cold', 'warm', 'hot', 'buyer');

-- CreateEnum: AudienceSource
CREATE TYPE "AudienceSource" AS ENUM ('follower', 'non_follower', 'existing_customer', 'referral');

-- CreateEnum: ChannelAttribution
CREATE TYPE "ChannelAttribution" AS ENUM ('meta', 'instagram', 'youtube', 'whatsapp', 'email', 'organic', 'dark_ad', 'referral', 'manual');

-- AlterTable: Add new columns to lead_capture_records
ALTER TABLE "lead_capture_records" ADD COLUMN "lead_temperature" "LeadTemperature" NOT NULL DEFAULT 'cold';
ALTER TABLE "lead_capture_records" ADD COLUMN "audience_source" "AudienceSource";
ALTER TABLE "lead_capture_records" ADD COLUMN "channel_attribution" "ChannelAttribution";
ALTER TABLE "lead_capture_records" ADD COLUMN "sales_notes" TEXT;
ALTER TABLE "lead_capture_records" ADD COLUMN "next_action" TEXT;
ALTER TABLE "lead_capture_records" ADD COLUMN "follow_up_date" TIMESTAMP(3);
ALTER TABLE "lead_capture_records" ADD COLUMN "meeting_date" TIMESTAMP(3);
ALTER TABLE "lead_capture_records" ADD COLUMN "meeting_type" TEXT;
ALTER TABLE "lead_capture_records" ADD COLUMN "meeting_outcome" TEXT;
ALTER TABLE "lead_capture_records" ADD COLUMN "purchase_date" TIMESTAMP(3);
ALTER TABLE "lead_capture_records" ADD COLUMN "purchase_amount" DECIMAL(12,2);
ALTER TABLE "lead_capture_records" ADD COLUMN "purchase_reference" TEXT;

-- CreateIndex: New indexes on lead_capture_records
CREATE INDEX "lead_capture_records_lead_temperature_idx" ON "lead_capture_records"("lead_temperature");
CREATE INDEX "lead_capture_records_audience_source_idx" ON "lead_capture_records"("audience_source");
CREATE INDEX "lead_capture_records_channel_attribution_idx" ON "lead_capture_records"("channel_attribution");
CREATE INDEX "lead_capture_records_follow_up_date_idx" ON "lead_capture_records"("follow_up_date");

-- CreateTable: lead_lifecycle_events
CREATE TABLE "lead_lifecycle_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "lead_id" UUID NOT NULL,
    "from_status" "LeadStatus",
    "to_status" "LeadStatus" NOT NULL,
    "from_temperature" "LeadTemperature",
    "to_temperature" "LeadTemperature",
    "actor_user_id" UUID,
    "reason" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_lifecycle_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "lead_lifecycle_events_tenant_key_idx" ON "lead_lifecycle_events"("tenant_key");
CREATE INDEX "lead_lifecycle_events_lead_id_idx" ON "lead_lifecycle_events"("lead_id");
CREATE INDEX "lead_lifecycle_events_to_status_idx" ON "lead_lifecycle_events"("to_status");
CREATE INDEX "lead_lifecycle_events_created_at_idx" ON "lead_lifecycle_events"("created_at");

ALTER TABLE "lead_lifecycle_events" ADD CONSTRAINT "lead_lifecycle_events_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_lifecycle_events" ADD CONSTRAINT "lead_lifecycle_events_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "lead_capture_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lead_lifecycle_events" ADD CONSTRAINT "lead_lifecycle_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
