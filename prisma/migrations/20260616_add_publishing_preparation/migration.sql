-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('draft', 'validating', 'ready_for_future_execution', 'blocked', 'superseded', 'cancelled');

-- CreateEnum
CREATE TYPE "PackageType" AS ENUM ('single_post', 'multi_platform_campaign', 'carousel', 'video_post', 'story', 'thread');

-- CreateEnum
CREATE TYPE "PackageItemStatus" AS ENUM ('pending', 'validated', 'blocked', 'excluded');

-- CreateEnum
CREATE TYPE "PackageItemType" AS ENUM ('platform_caption', 'asset_reference', 'hashtag_set', 'cta', 'link_reference', 'compliance_note', 'approval_evidence', 'saif_evidence', 'asset_cognition_evidence');

-- CreateEnum
CREATE TYPE "TargetStatus" AS ENUM ('pending', 'validated', 'blocked', 'ready');

-- CreateEnum
CREATE TYPE "CheckStatus" AS ENUM ('pending', 'passed', 'failed', 'skipped', 'blocked');

-- CreateEnum
CREATE TYPE "CheckSeverity" AS ENUM ('info', 'warning', 'error', 'critical');

-- CreateEnum
CREATE TYPE "ManifestStatus" AS ENUM ('draft', 'generated', 'validated', 'superseded');

-- CreateTable
CREATE TABLE "publishing_packages" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "package_status" "PackageStatus" NOT NULL DEFAULT 'draft',
    "package_type" "PackageType" NOT NULL DEFAULT 'single_post',
    "campaign_id" UUID,
    "content_item_id" UUID,
    "draft_version_id" UUID,
    "saif_decision_record_id" UUID,
    "approval_id" UUID,
    "capability_resolution_id" UUID,
    "mcp_mediation_request_id" UUID,
    "spine_run_id" UUID,
    "spine_artifact_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_by_agent_rep_id" UUID NOT NULL,
    "readiness_score" DOUBLE PRECISION,
    "readiness_summary" TEXT,
    "blocked_reasons" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_package_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publishing_package_id" UUID NOT NULL,
    "item_type" "PackageItemType" NOT NULL,
    "item_status" "PackageItemStatus" NOT NULL DEFAULT 'pending',
    "source_object_type" TEXT,
    "source_object_id" TEXT,
    "platform" TEXT,
    "content_summary" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_package_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_targets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publishing_package_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "account_reference" TEXT,
    "target_status" "TargetStatus" NOT NULL DEFAULT 'pending',
    "proposed_publish_at" TIMESTAMP(3),
    "timezone" TEXT,
    "platform_format" TEXT,
    "platform_constraints" JSONB,
    "requires_mcp" BOOLEAN NOT NULL DEFAULT false,
    "future_connector_reference" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_readiness_checks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publishing_package_id" UUID NOT NULL,
    "check_type" TEXT NOT NULL,
    "check_status" "CheckStatus" NOT NULL DEFAULT 'pending',
    "severity" "CheckSeverity" NOT NULL DEFAULT 'info',
    "message" TEXT,
    "source_object_type" TEXT,
    "source_object_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publishing_readiness_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publishing_manifests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "publishing_package_id" UUID NOT NULL,
    "manifest_version" INTEGER NOT NULL DEFAULT 1,
    "manifest_status" "ManifestStatus" NOT NULL DEFAULT 'draft',
    "package_hash" TEXT,
    "manifest_summary" TEXT,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generated_by_user_id" UUID NOT NULL,
    "generated_by_agent_rep_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publishing_manifests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "publishing_packages_package_status_idx" ON "publishing_packages"("package_status");

-- CreateIndex
CREATE INDEX "publishing_packages_campaign_id_idx" ON "publishing_packages"("campaign_id");

-- CreateIndex
CREATE INDEX "publishing_packages_content_item_id_idx" ON "publishing_packages"("content_item_id");

-- CreateIndex
CREATE INDEX "publishing_packages_created_by_user_id_idx" ON "publishing_packages"("created_by_user_id");

-- CreateIndex
CREATE INDEX "publishing_package_items_publishing_package_id_idx" ON "publishing_package_items"("publishing_package_id");

-- CreateIndex
CREATE INDEX "publishing_package_items_item_type_idx" ON "publishing_package_items"("item_type");

-- CreateIndex
CREATE INDEX "publishing_targets_publishing_package_id_idx" ON "publishing_targets"("publishing_package_id");

-- CreateIndex
CREATE INDEX "publishing_targets_platform_idx" ON "publishing_targets"("platform");

-- CreateIndex
CREATE INDEX "publishing_readiness_checks_publishing_package_id_idx" ON "publishing_readiness_checks"("publishing_package_id");

-- CreateIndex
CREATE INDEX "publishing_readiness_checks_check_type_idx" ON "publishing_readiness_checks"("check_type");

-- CreateIndex
CREATE INDEX "publishing_readiness_checks_check_status_idx" ON "publishing_readiness_checks"("check_status");

-- CreateIndex
CREATE UNIQUE INDEX "publishing_manifests_publishing_package_id_key" ON "publishing_manifests"("publishing_package_id");

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_packages" ADD CONSTRAINT "publishing_packages_created_by_agent_rep_id_fkey" FOREIGN KEY ("created_by_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_package_items" ADD CONSTRAINT "publishing_package_items_publishing_package_id_fkey" FOREIGN KEY ("publishing_package_id") REFERENCES "publishing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_targets" ADD CONSTRAINT "publishing_targets_publishing_package_id_fkey" FOREIGN KEY ("publishing_package_id") REFERENCES "publishing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_readiness_checks" ADD CONSTRAINT "publishing_readiness_checks_publishing_package_id_fkey" FOREIGN KEY ("publishing_package_id") REFERENCES "publishing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publishing_manifests" ADD CONSTRAINT "publishing_manifests_publishing_package_id_fkey" FOREIGN KEY ("publishing_package_id") REFERENCES "publishing_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
