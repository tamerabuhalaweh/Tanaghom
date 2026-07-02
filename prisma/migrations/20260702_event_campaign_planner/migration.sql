-- CreateEnum
CREATE TYPE "PlanApprovalStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'changes_requested');

-- CreateEnum
CREATE TYPE "EmailContentType" AS ENUM ('text', 'html', 'template');

-- CreateEnum
CREATE TYPE "WhatsappContentType" AS ENUM ('text', 'image', 'video');

-- CreateEnum
CREATE TYPE "ContentRequirementAssetType" AS ENUM ('video', 'image', 'caption', 'landing_page', 'carousel', 'story', 'email_template', 'whatsapp_template');

-- CreateEnum
CREATE TYPE "ContentRequirementStatus" AS ENUM ('pending', 'in_progress', 'ready', 'blocked', 'delivered');

-- CreateEnum
CREATE TYPE "SalesTaskType" AS ENUM ('inquiry_response', 'follow_up', 'closing', 'discovery_call', 'no_show_recovery', 'feedback_collection');

-- CreateEnum
CREATE TYPE "SalesTaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'blocked');

-- CreateTable: event_email_plans
CREATE TABLE "event_email_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "sequence_name" TEXT NOT NULL,
    "audience_segment" TEXT,
    "email_count" INTEGER NOT NULL DEFAULT 1,
    "planned_send_dates" JSONB,
    "subject_draft" TEXT,
    "content_draft" TEXT,
    "content_type" "EmailContentType" NOT NULL DEFAULT 'text',
    "approval_status" "PlanApprovalStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_email_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_email_plans_tenant_key_idx" ON "event_email_plans"("tenant_key");
CREATE INDEX "event_email_plans_event_id_idx" ON "event_email_plans"("event_id");
CREATE INDEX "event_email_plans_approval_status_idx" ON "event_email_plans"("approval_status");

ALTER TABLE "event_email_plans" ADD CONSTRAINT "event_email_plans_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_email_plans" ADD CONSTRAINT "event_email_plans_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_email_plans" ADD CONSTRAINT "event_email_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: event_whatsapp_plans
CREATE TABLE "event_whatsapp_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "audience_segment" TEXT,
    "frequency" TEXT,
    "content_type" "WhatsappContentType" NOT NULL DEFAULT 'text',
    "message_draft" TEXT,
    "approval_status" "PlanApprovalStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_whatsapp_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_whatsapp_plans_tenant_key_idx" ON "event_whatsapp_plans"("tenant_key");
CREATE INDEX "event_whatsapp_plans_event_id_idx" ON "event_whatsapp_plans"("event_id");
CREATE INDEX "event_whatsapp_plans_approval_status_idx" ON "event_whatsapp_plans"("approval_status");

ALTER TABLE "event_whatsapp_plans" ADD CONSTRAINT "event_whatsapp_plans_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_whatsapp_plans" ADD CONSTRAINT "event_whatsapp_plans_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_whatsapp_plans" ADD CONSTRAINT "event_whatsapp_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: event_upsell_plans
CREATE TABLE "event_upsell_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "target_segment" TEXT,
    "offer" TEXT,
    "fomo_angle" TEXT,
    "planned_channel" TEXT,
    "approval_status" "PlanApprovalStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_upsell_plans_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_upsell_plans_tenant_key_idx" ON "event_upsell_plans"("tenant_key");
CREATE INDEX "event_upsell_plans_event_id_idx" ON "event_upsell_plans"("event_id");
CREATE INDEX "event_upsell_plans_approval_status_idx" ON "event_upsell_plans"("approval_status");

ALTER TABLE "event_upsell_plans" ADD CONSTRAINT "event_upsell_plans_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_upsell_plans" ADD CONSTRAINT "event_upsell_plans_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_upsell_plans" ADD CONSTRAINT "event_upsell_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: event_content_requirements
CREATE TABLE "event_content_requirements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "asset_type" "ContentRequirementAssetType" NOT NULL,
    "description" TEXT,
    "platform" TEXT,
    "due_date" TIMESTAMP(3),
    "status" "ContentRequirementStatus" NOT NULL DEFAULT 'pending',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_content_requirements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_content_requirements_tenant_key_idx" ON "event_content_requirements"("tenant_key");
CREATE INDEX "event_content_requirements_event_id_idx" ON "event_content_requirements"("event_id");
CREATE INDEX "event_content_requirements_status_idx" ON "event_content_requirements"("status");
CREATE INDEX "event_content_requirements_asset_type_idx" ON "event_content_requirements"("asset_type");

ALTER TABLE "event_content_requirements" ADD CONSTRAINT "event_content_requirements_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_content_requirements" ADD CONSTRAINT "event_content_requirements_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_content_requirements" ADD CONSTRAINT "event_content_requirements_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: event_sales_tasks
CREATE TABLE "event_sales_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL,
    "event_id" UUID NOT NULL,
    "task_type" "SalesTaskType" NOT NULL,
    "owner_role" TEXT,
    "description" TEXT,
    "due_date" TIMESTAMP(3),
    "status" "SalesTaskStatus" NOT NULL DEFAULT 'pending',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_sales_tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "event_sales_tasks_tenant_key_idx" ON "event_sales_tasks"("tenant_key");
CREATE INDEX "event_sales_tasks_event_id_idx" ON "event_sales_tasks"("event_id");
CREATE INDEX "event_sales_tasks_status_idx" ON "event_sales_tasks"("status");
CREATE INDEX "event_sales_tasks_task_type_idx" ON "event_sales_tasks"("task_type");

ALTER TABLE "event_sales_tasks" ADD CONSTRAINT "event_sales_tasks_tenant_key_fkey" FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_sales_tasks" ADD CONSTRAINT "event_sales_tasks_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "commercial_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "event_sales_tasks" ADD CONSTRAINT "event_sales_tasks_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
