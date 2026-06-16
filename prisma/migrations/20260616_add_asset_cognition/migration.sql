-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('image', 'video', 'document', 'audio', 'template', 'carousel', 'thumbnail', 'brand_guideline', 'creative_brief', 'publishing_package', 'other');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('draft', 'pending_review', 'approved', 'rejected', 'archived', 'superseded');

-- CreateEnum
CREATE TYPE "CognitionType" AS ENUM ('brand_alignment', 'compliance_status', 'usage_context', 'performance_data', 'platform_fit', 'audience_fit', 'quality_assessment');

-- CreateEnum
CREATE TYPE "ExternalReferenceType" AS ENUM ('resourcespace_asset', 'rendering_output', 'design_tool_link', 'storage_object', 'dam_reference');

-- CreateEnum
CREATE TYPE "ExternalSyncStatus" AS ENUM ('synced', 'pending', 'conflict', 'stale', 'unknown');

-- CreateEnum
CREATE TYPE "AssetLineageType" AS ENUM ('derived_from', 'variant_of', 'approved_version_of', 'rendered_from', 'used_in', 'supports', 'replaces', 'references');

-- CreateTable
CREATE TABLE "assets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_type" "AssetType" NOT NULL,
    "asset_status" "AssetStatus" NOT NULL DEFAULT 'draft',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "canonical_owner" TEXT,
    "sensitivity" TEXT,
    "classification" TEXT,
    "source_object_type" TEXT,
    "source_object_id" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_by_agent_rep_id" UUID NOT NULL,
    "spine_artifact_id" UUID,
    "saif_decision_record_id" UUID,
    "approval_id" UUID,
    "capability_resolution_id" UUID,
    "content_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_cognition_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "cognition_type" "CognitionType" NOT NULL,
    "summary" TEXT,
    "tags" TEXT[],
    "detected_topics" TEXT[],
    "brand_fit_score" DOUBLE PRECISION,
    "compliance_risk" TEXT,
    "usage_guidance" TEXT,
    "platform_fit" JSONB,
    "audience_fit" JSONB,
    "source_method" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "reviewed_by_user_id" UUID,
    "reviewed_by_agent_rep_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_cognition_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "external_asset_references" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "asset_id" UUID NOT NULL,
    "external_system" TEXT NOT NULL,
    "external_reference_id" TEXT NOT NULL,
    "external_url_placeholder" TEXT,
    "reference_type" "ExternalReferenceType" NOT NULL,
    "sync_status" "ExternalSyncStatus" NOT NULL DEFAULT 'unknown',
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "external_asset_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_lineage" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_asset_id" UUID NOT NULL,
    "target_asset_id" UUID NOT NULL,
    "relationship_type" "AssetLineageType" NOT NULL,
    "rationale" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_by_agent_rep_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "asset_lineage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "assets_asset_type_idx" ON "assets"("asset_type");

-- CreateIndex
CREATE INDEX "assets_asset_status_idx" ON "assets"("asset_status");

-- CreateIndex
CREATE INDEX "assets_created_by_user_id_idx" ON "assets"("created_by_user_id");

-- CreateIndex
CREATE INDEX "assets_source_object_type_source_object_id_idx" ON "assets"("source_object_type", "source_object_id");

-- CreateIndex
CREATE INDEX "assets_content_hash_idx" ON "assets"("content_hash");

-- CreateIndex
CREATE INDEX "asset_cognition_records_asset_id_idx" ON "asset_cognition_records"("asset_id");

-- CreateIndex
CREATE INDEX "asset_cognition_records_cognition_type_idx" ON "asset_cognition_records"("cognition_type");

-- CreateIndex
CREATE INDEX "asset_cognition_records_confidence_idx" ON "asset_cognition_records"("confidence");

-- CreateIndex
CREATE INDEX "external_asset_references_asset_id_idx" ON "external_asset_references"("asset_id");

-- CreateIndex
CREATE INDEX "external_asset_references_external_system_idx" ON "external_asset_references"("external_system");

-- CreateIndex
CREATE INDEX "external_asset_references_reference_type_idx" ON "external_asset_references"("reference_type");

-- CreateIndex
CREATE UNIQUE INDEX "asset_lineage_source_asset_id_target_asset_id_relationshi_key" ON "asset_lineage"("source_asset_id", "target_asset_id", "relationship_type");

-- CreateIndex
CREATE INDEX "asset_lineage_source_asset_id_idx" ON "asset_lineage"("source_asset_id");

-- CreateIndex
CREATE INDEX "asset_lineage_target_asset_id_idx" ON "asset_lineage"("target_asset_id");

-- CreateIndex
CREATE INDEX "asset_lineage_relationship_type_idx" ON "asset_lineage"("relationship_type");

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_created_by_agent_rep_id_fkey" FOREIGN KEY ("created_by_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_cognition_records" ADD CONSTRAINT "asset_cognition_records_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "external_asset_references" ADD CONSTRAINT "external_asset_references_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lineage" ADD CONSTRAINT "asset_lineage_source_asset_id_fkey" FOREIGN KEY ("source_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lineage" ADD CONSTRAINT "asset_lineage_target_asset_id_fkey" FOREIGN KEY ("target_asset_id") REFERENCES "assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lineage" ADD CONSTRAINT "asset_lineage_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_lineage" ADD CONSTRAINT "asset_lineage_created_by_agent_rep_id_fkey" FOREIGN KEY ("created_by_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
