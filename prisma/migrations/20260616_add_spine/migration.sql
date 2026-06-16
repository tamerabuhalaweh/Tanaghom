-- CreateEnum
CREATE TYPE "SpineRunType" AS ENUM ('planned', 'simulated', 'advisory', 'execution');

-- CreateEnum
CREATE TYPE "SpineRunStatus" AS ENUM ('planned', 'ready', 'simulated', 'running', 'succeeded', 'failed', 'cancelled', 'blocked', 'audited');

-- CreateEnum
CREATE TYPE "SpineReplayStatus" AS ENUM ('replayable', 'partial', 'not_replayable');

-- CreateEnum
CREATE TYPE "SpineArtifactType" AS ENUM ('campaign_request_snapshot', 'draft_version_snapshot', 'reach_score_report', 'approval_record_snapshot', 'saif_decision_record', 'dks_reference_bundle', 'capability_resolution_bundle', 'mediation_decision_record', 'future_publishing_package');

-- CreateEnum
CREATE TYPE "SpineArtifactStatus" AS ENUM ('created', 'validated', 'archived', 'superseded');

-- CreateEnum
CREATE TYPE "SpineArtifactLinkType" AS ENUM ('derived_from', 'supports', 'supersedes', 'evidence_for', 'produced_by', 'consumed_by', 'references');

-- CreateTable
CREATE TABLE "spine_runs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "run_type" "SpineRunType" NOT NULL DEFAULT 'planned',
    "run_status" "SpineRunStatus" NOT NULL DEFAULT 'planned',
    "human_user_id" UUID NOT NULL,
    "agent_rep_id" UUID NOT NULL,
    "acting_agent_type" TEXT NOT NULL,
    "acting_agent_id" TEXT,
    "saif_decision_record_id" UUID,
    "capability_resolution_id" UUID,
    "approval_id" UUID,
    "mcp_mediation_request_id" UUID,
    "mcp_mediation_decision_id" UUID,
    "parent_run_id" UUID,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "failed_at" TIMESTAMP(3),
    "rationale" TEXT,
    "expected_outcome" TEXT,
    "actual_outcome" TEXT,
    "failure_reason" TEXT,
    "replay_status" "SpineReplayStatus" NOT NULL DEFAULT 'replayable',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spine_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spine_artifacts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "artifact_type" "SpineArtifactType" NOT NULL,
    "artifact_status" "SpineArtifactStatus" NOT NULL DEFAULT 'created',
    "canonical_owner" TEXT,
    "source_object_type" TEXT,
    "source_object_id" TEXT,
    "run_id" UUID NOT NULL,
    "saif_decision_record_id" UUID,
    "capability_resolution_id" UUID,
    "approval_id" UUID,
    "content_hash" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "summary" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_by_agent_rep_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spine_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "spine_artifact_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_artifact_id" UUID NOT NULL,
    "target_artifact_id" UUID NOT NULL,
    "relationship_type" "SpineArtifactLinkType" NOT NULL,
    "rationale" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "spine_artifact_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "spine_runs_human_user_id_idx" ON "spine_runs"("human_user_id");

-- CreateIndex
CREATE INDEX "spine_runs_agent_rep_id_idx" ON "spine_runs"("agent_rep_id");

-- CreateIndex
CREATE INDEX "spine_runs_run_status_idx" ON "spine_runs"("run_status");

-- CreateIndex
CREATE INDEX "spine_runs_run_type_idx" ON "spine_runs"("run_type");

-- CreateIndex
CREATE INDEX "spine_runs_parent_run_id_idx" ON "spine_runs"("parent_run_id");

-- CreateIndex
CREATE INDEX "spine_runs_saif_decision_record_id_idx" ON "spine_runs"("saif_decision_record_id");

-- CreateIndex
CREATE INDEX "spine_runs_capability_resolution_id_idx" ON "spine_runs"("capability_resolution_id");

-- CreateIndex
CREATE INDEX "spine_artifacts_run_id_idx" ON "spine_artifacts"("run_id");

-- CreateIndex
CREATE INDEX "spine_artifacts_artifact_type_idx" ON "spine_artifacts"("artifact_type");

-- CreateIndex
CREATE INDEX "spine_artifacts_artifact_status_idx" ON "spine_artifacts"("artifact_status");

-- CreateIndex
CREATE INDEX "spine_artifacts_source_object_type_source_object_id_idx" ON "spine_artifacts"("source_object_type", "source_object_id");

-- CreateIndex
CREATE INDEX "spine_artifacts_created_by_user_id_idx" ON "spine_artifacts"("created_by_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "spine_artifact_links_source_artifact_id_target_artifact_id_r_key" ON "spine_artifact_links"("source_artifact_id", "target_artifact_id", "relationship_type");

-- CreateIndex
CREATE INDEX "spine_artifact_links_source_artifact_id_idx" ON "spine_artifact_links"("source_artifact_id");

-- CreateIndex
CREATE INDEX "spine_artifact_links_target_artifact_id_idx" ON "spine_artifact_links"("target_artifact_id");

-- CreateIndex
CREATE INDEX "spine_artifact_links_relationship_type_idx" ON "spine_artifact_links"("relationship_type");

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_human_user_id_fkey" FOREIGN KEY ("human_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_agent_rep_id_fkey" FOREIGN KEY ("agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_saif_decision_record_id_fkey" FOREIGN KEY ("saif_decision_record_id") REFERENCES "saif_decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_capability_resolution_id_fkey" FOREIGN KEY ("capability_resolution_id") REFERENCES "capability_resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_mcp_mediation_request_id_fkey" FOREIGN KEY ("mcp_mediation_request_id") REFERENCES "mcp_mediation_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_mcp_mediation_decision_id_fkey" FOREIGN KEY ("mcp_mediation_decision_id") REFERENCES "mcp_mediation_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_runs" ADD CONSTRAINT "spine_runs_parent_run_id_fkey" FOREIGN KEY ("parent_run_id") REFERENCES "spine_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifacts" ADD CONSTRAINT "spine_artifacts_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "spine_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifacts" ADD CONSTRAINT "spine_artifacts_saif_decision_record_id_fkey" FOREIGN KEY ("saif_decision_record_id") REFERENCES "saif_decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifacts" ADD CONSTRAINT "spine_artifacts_capability_resolution_id_fkey" FOREIGN KEY ("capability_resolution_id") REFERENCES "capability_resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifacts" ADD CONSTRAINT "spine_artifacts_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifacts" ADD CONSTRAINT "spine_artifacts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifacts" ADD CONSTRAINT "spine_artifacts_created_by_agent_rep_id_fkey" FOREIGN KEY ("created_by_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifact_links" ADD CONSTRAINT "spine_artifact_links_source_artifact_id_fkey" FOREIGN KEY ("source_artifact_id") REFERENCES "spine_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "spine_artifact_links" ADD CONSTRAINT "spine_artifact_links_target_artifact_id_fkey" FOREIGN KEY ("target_artifact_id") REFERENCES "spine_artifacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
