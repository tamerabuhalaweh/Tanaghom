-- CreateEnum
CREATE TYPE "SurfaceType" AS ENUM ('paperclip', 'internal_web_app', 'future_chat_surface', 'future_dashboard_surface');

-- CreateEnum
CREATE TYPE "SurfaceStatus" AS ENUM ('active', 'inactive', 'planned');

-- CreateEnum
CREATE TYPE "SurfaceDirection" AS ENUM ('stitch_to_surface', 'surface_to_stitch', 'bidirectional');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('approval', 'review', 'assignment', 'notification', 'status_update');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'completed', 'cancelled', 'blocked');

-- CreateEnum
CREATE TYPE "RelayDirection" AS ENUM ('inbound', 'outbound');

-- CreateEnum
CREATE TYPE "RelayEventStatus" AS ENUM ('received', 'processed', 'blocked', 'requires_review', 'failed');

-- CreateEnum
CREATE TYPE "SyncPolicyType" AS ENUM ('stitch_to_surface_read_only', 'surface_to_stitch_review_required', 'surface_to_stitch_blocked', 'surface_status_projection_only');

-- CreateEnum
CREATE TYPE "ReferenceSyncStatus" AS ENUM ('synced', 'pending', 'conflict', 'stale', 'unknown');

-- CreateTable
CREATE TABLE "operating_surfaces" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "surface_type" "SurfaceType" NOT NULL,
    "status" "SurfaceStatus" NOT NULL DEFAULT 'active',
    "description" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT true,
    "canonical_authority" TEXT NOT NULL DEFAULT 'stitch',
    "allowed_directions" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operating_surfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surface_tasks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operating_surface_id" UUID NOT NULL,
    "external_task_reference" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "task_type" "TaskType" NOT NULL DEFAULT 'assignment',
    "task_status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "canonical_target_type" TEXT,
    "canonical_target_id" TEXT,
    "assigned_user_id" UUID,
    "assigned_agent_rep_id" UUID,
    "approval_id" UUID,
    "saif_decision_record_id" UUID,
    "spine_run_id" UUID,
    "capability_resolution_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "created_by_agent_rep_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surface_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surface_status_projections" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operating_surface_id" UUID NOT NULL,
    "canonical_object_type" TEXT NOT NULL,
    "canonical_object_id" TEXT NOT NULL,
    "projected_status" TEXT NOT NULL,
    "projected_summary" TEXT,
    "source_substrate" TEXT,
    "last_projected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surface_status_projections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surface_relay_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operating_surface_id" UUID NOT NULL,
    "direction" "RelayDirection" NOT NULL,
    "event_type" TEXT NOT NULL,
    "event_status" "RelayEventStatus" NOT NULL DEFAULT 'received',
    "canonical_object_type" TEXT,
    "canonical_object_id" TEXT,
    "external_reference" TEXT,
    "payload_summary" TEXT,
    "human_user_id" UUID,
    "agent_rep_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),
    "result" TEXT,

    CONSTRAINT "surface_relay_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "paperclip_references" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canonical_object_type" TEXT NOT NULL,
    "canonical_object_id" TEXT NOT NULL,
    "paperclip_object_type" TEXT NOT NULL,
    "paperclip_reference_id" TEXT NOT NULL,
    "sync_status" "ReferenceSyncStatus" NOT NULL DEFAULT 'unknown',
    "last_checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "paperclip_references_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "surface_sync_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "operating_surface_id" UUID NOT NULL,
    "canonical_object_type" TEXT NOT NULL,
    "direction" "SurfaceDirection" NOT NULL,
    "policy_type" "SyncPolicyType" NOT NULL,
    "requires_review" BOOLEAN NOT NULL DEFAULT true,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "allowed_fields" TEXT[],
    "blocked_fields" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "surface_sync_policies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "operating_surfaces_name_key" ON "operating_surfaces"("name");

-- CreateIndex
CREATE INDEX "operating_surfaces_surface_type_idx" ON "operating_surfaces"("surface_type");

-- CreateIndex
CREATE INDEX "operating_surfaces_status_idx" ON "operating_surfaces"("status");

-- CreateIndex
CREATE INDEX "surface_tasks_operating_surface_id_idx" ON "surface_tasks"("operating_surface_id");

-- CreateIndex
CREATE INDEX "surface_tasks_task_status_idx" ON "surface_tasks"("task_status");

-- CreateIndex
CREATE INDEX "surface_tasks_canonical_target_type_canonical_target_id_idx" ON "surface_tasks"("canonical_target_type", "canonical_target_id");

-- CreateIndex
CREATE INDEX "surface_tasks_assigned_user_id_idx" ON "surface_tasks"("assigned_user_id");

-- CreateIndex
CREATE INDEX "surface_status_projections_operating_surface_id_idx" ON "surface_status_projections"("operating_surface_id");

-- CreateIndex
CREATE INDEX "surface_status_projections_canonical_object_type_canonical_objec_idx" ON "surface_status_projections"("canonical_object_type", "canonical_object_id");

-- CreateIndex
CREATE INDEX "surface_relay_events_operating_surface_id_idx" ON "surface_relay_events"("operating_surface_id");

-- CreateIndex
CREATE INDEX "surface_relay_events_direction_idx" ON "surface_relay_events"("direction");

-- CreateIndex
CREATE INDEX "surface_relay_events_event_status_idx" ON "surface_relay_events"("event_status");

-- CreateIndex
CREATE INDEX "surface_relay_events_canonical_object_type_canonical_object_id_idx" ON "surface_relay_events"("canonical_object_type", "canonical_object_id");

-- CreateIndex
CREATE INDEX "paperclip_references_canonical_object_type_canonical_object_id_idx" ON "paperclip_references"("canonical_object_type", "canonical_object_id");

-- CreateIndex
CREATE INDEX "paperclip_references_paperclip_reference_id_idx" ON "paperclip_references"("paperclip_reference_id");

-- CreateIndex
CREATE INDEX "surface_sync_policies_operating_surface_id_idx" ON "surface_sync_policies"("operating_surface_id");

-- CreateIndex
CREATE INDEX "surface_sync_policies_policy_type_idx" ON "surface_sync_policies"("policy_type");

-- AddForeignKey
ALTER TABLE "surface_tasks" ADD CONSTRAINT "surface_tasks_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surface_status_projections" ADD CONSTRAINT "surface_status_projections_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surface_relay_events" ADD CONSTRAINT "surface_relay_events_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surface_sync_policies" ADD CONSTRAINT "surface_sync_policies_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
