-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'cco', 'department_head', 'specialist', 'reviewer', 'viewer');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('functional', 'governance');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('active', 'inactive', 'suspended');

-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('campaign', 'announcement', 'thought_leadership', 'product_update', 'hiring', 'event', 'evergreen', 'reactive');

-- CreateEnum
CREATE TYPE "RiskCategory" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "ContentState" AS ENUM ('idea', 'drafting', 'pending_review', 'needs_edits', 'approved', 'scheduled', 'published', 'analytics_pending', 'analyzed', 'archived', 'recycle_candidate', 'failed', 'expired', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('approved', 'rejected', 'needs_changes');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('pending', 'scheduled', 'published', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "MetricWindow" AS ENUM ('h48', 'd7', 'd30');

-- CreateEnum
CREATE TYPE "InsightType" AS ENUM ('content_type', 'hook', 'cta', 'timing', 'format', 'topic');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('official_docs', 'official_policy', 'internal_benchmark', 'team_decision', 'third_party_research', 'internal_analytics');

-- CreateEnum
CREATE TYPE "RuleSource" AS ENUM ('official_docs', 'third_party_research', 'internal_analytics');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('draft', 'context_gathering', 'proposed', 'evaluating', 'authority_review', 'accepted', 'rejected', 'deferred', 'execution_ready', 'superseded', 'audited');

-- CreateEnum
CREATE TYPE "DecisionRole" AS ENUM ('context', 'proposer', 'evaluator', 'authority');

-- CreateEnum
CREATE TYPE "EvaluationDimension" AS ENUM ('capability_impact', 'security_posture', 'cost', 'latency', 'maintainability', 'reversibility', 'human_oversight', 'compliance', 'observability', 'learning_potential');

-- CreateEnum
CREATE TYPE "RatingValue" AS ENUM ('positive', 'neutral', 'negative');

-- CreateEnum
CREATE TYPE "FreshnessStatus" AS ENUM ('fresh', 'stale', 'expired', 'unknown');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('pending', 'acknowledged', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "DksSourceType" AS ENUM ('official_docs', 'official_policy', 'internal_benchmark', 'team_decision', 'third_party_research', 'internal_analytics', 'saif_decision', 'platform_rule', 'learning_insight');

-- CreateTable
CREATE TABLE "departments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "department_id" UUID,
    "role" "Role" NOT NULL DEFAULT 'reviewer',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_reps" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "agent_type" "AgentType" NOT NULL DEFAULT 'functional',
    "status" "AgentStatus" NOT NULL DEFAULT 'active',
    "permissions_context" JSONB,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_reps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "functional_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_rep_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "capability" TEXT NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'active',
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "functional_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "governance_agents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "agent_rep_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "policy_scope" TEXT[],
    "veto_authority" BOOLEAN NOT NULL DEFAULT false,
    "status" "AgentStatus" NOT NULL DEFAULT 'active',
    "config" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "governance_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requester_id" UUID NOT NULL,
    "channel" TEXT NOT NULL,
    "raw_message" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "audience" TEXT,
    "campaign_id" UUID,
    "owner_department_id" UUID,
    "content_type" "ContentType" NOT NULL DEFAULT 'campaign',
    "risk_category" "RiskCategory" NOT NULL DEFAULT 'low',
    "target_platforms" TEXT[],
    "deadline" TIMESTAMP(3),
    "cta" TEXT,
    "media_refs" JSONB,
    "status" "ContentState" NOT NULL DEFAULT 'idea',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "request_id" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'post',
    "draft_text" TEXT NOT NULL,
    "media_refs" JSONB,
    "risk_score" INTEGER NOT NULL DEFAULT 0,
    "risk_reason" TEXT,
    "reach_score" INTEGER NOT NULL DEFAULT 0,
    "reach_breakdown" JSONB,
    "status" "ContentState" NOT NULL DEFAULT 'drafting',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "draft_versions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "model_used" TEXT,
    "prompt_hash" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "draft_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "reviewer_id" UUID NOT NULL,
    "department" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL,
    "comments" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "content_item_id" UUID NOT NULL,
    "postiz_post_id" TEXT,
    "integration_id" TEXT,
    "scheduled_at" TIMESTAMP(3) NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" "ScheduleStatus" NOT NULL DEFAULT 'pending',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedule_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analytics_snapshots" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "postiz_post_id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metric_name" TEXT NOT NULL,
    "metric_value" DOUBLE PRECISION NOT NULL,
    "metric_window" "MetricWindow" NOT NULL,

    CONSTRAINT "analytics_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_insights" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "insight_type" "InsightType" NOT NULL,
    "evidence_summary" TEXT NOT NULL,
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "recommendation" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "learning_insights_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_value" TEXT NOT NULL,
    "source_url" TEXT,
    "source_type" "SourceType" NOT NULL DEFAULT 'team_decision',
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "owner" TEXT,
    "last_reviewed_at" TIMESTAMP(3),
    "next_review_at" TIMESTAMP(3),
    "agent_instruction" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "object_type" TEXT NOT NULL,
    "object_id" UUID,
    "input_hash" TEXT,
    "output_hash" TEXT,
    "result" TEXT,
    "policy_decision" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reach_optimization_rules" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "platform" TEXT NOT NULL,
    "rule_type" TEXT NOT NULL,
    "rule_value" TEXT NOT NULL,
    "source_url" TEXT,
    "source_type" "RuleSource" NOT NULL DEFAULT 'official_docs',
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "owner" TEXT,
    "last_reviewed_at" TIMESTAMP(3),
    "next_review_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reach_optimization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saif_decision_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "decision_scope" TEXT NOT NULL,
    "complexity" TEXT DEFAULT 'medium',
    "status" "DecisionStatus" NOT NULL DEFAULT 'draft',
    "parent_decision_id" UUID,
    "human_user_id" UUID NOT NULL,
    "agent_rep_id" UUID NOT NULL,
    "authority_user_id" UUID,
    "authority_agent_rep_id" UUID,
    "rationale" TEXT,
    "alternatives_considered" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "risk_acceptance" TEXT,
    "execution_readiness" BOOLEAN NOT NULL DEFAULT false,
    "success_criteria" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saif_decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_role_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "role" "DecisionRole" NOT NULL,
    "human_user_id" UUID,
    "agent_rep_id" UUID,
    "functional_agent_id" UUID,
    "governance_agent_id" UUID,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_role_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "dimension" "EvaluationDimension" NOT NULL,
    "rating" "RatingValue" NOT NULL,
    "assessment" TEXT,
    "notes" TEXT,
    "mitigation" TEXT,
    "evaluated_by" UUID,
    "evaluated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_execution_handoffs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "implementation_spec" TEXT,
    "constraints" TEXT,
    "acceptance_criteria" TEXT,
    "expected_outcome" TEXT,
    "handoff_status" "HandoffStatus" NOT NULL DEFAULT 'pending',
    "handoff_to_agent_rep_id" UUID,
    "acknowledged_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "decision_execution_handoffs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dks_entries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "source" TEXT,
    "source_type" "DksSourceType" NOT NULL DEFAULT 'team_decision',
    "version" TEXT DEFAULT '1.0',
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "last_reviewed_at" TIMESTAMP(3),
    "freshness_status" "FreshnessStatus" NOT NULL DEFAULT 'unknown',
    "owner" TEXT,
    "tags" TEXT[],
    "summary" TEXT,
    "content" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dks_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_dks_links" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "decision_id" UUID NOT NULL,
    "dks_entry_id" UUID NOT NULL,
    "link_context" TEXT NOT NULL DEFAULT 'evaluation',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "decision_dks_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "agent_reps_user_id_key" ON "agent_reps"("user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_idx" ON "audit_logs"("actor");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_object_type_object_id_idx" ON "audit_logs"("object_type", "object_id");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- CreateIndex
CREATE INDEX "saif_decision_records_human_user_id_idx" ON "saif_decision_records"("human_user_id");

-- CreateIndex
CREATE INDEX "saif_decision_records_agent_rep_id_idx" ON "saif_decision_records"("agent_rep_id");

-- CreateIndex
CREATE INDEX "saif_decision_records_status_idx" ON "saif_decision_records"("status");

-- CreateIndex
CREATE INDEX "saif_decision_records_parent_decision_id_idx" ON "saif_decision_records"("parent_decision_id");

-- CreateIndex
CREATE INDEX "decision_role_assignments_decision_id_idx" ON "decision_role_assignments"("decision_id");

-- CreateIndex
CREATE INDEX "decision_role_assignments_role_idx" ON "decision_role_assignments"("role");

-- CreateIndex
CREATE UNIQUE INDEX "decision_evaluations_decision_id_dimension_key" ON "decision_evaluations"("decision_id", "dimension");

-- CreateIndex
CREATE INDEX "decision_evaluations_decision_id_idx" ON "decision_evaluations"("decision_id");

-- CreateIndex
CREATE UNIQUE INDEX "decision_execution_handoffs_decision_id_key" ON "decision_execution_handoffs"("decision_id");

-- CreateIndex
CREATE INDEX "dks_entries_source_type_idx" ON "dks_entries"("source_type");

-- CreateIndex
CREATE INDEX "dks_entries_freshness_status_idx" ON "dks_entries"("freshness_status");

-- CreateIndex
CREATE INDEX "dks_entries_owner_idx" ON "dks_entries"("owner");

-- CreateIndex
CREATE UNIQUE INDEX "decision_dks_links_decision_id_dks_entry_id_key" ON "decision_dks_links"("decision_id", "dks_entry_id");

-- CreateIndex
CREATE INDEX "decision_dks_links_decision_id_idx" ON "decision_dks_links"("decision_id");

-- CreateIndex
CREATE INDEX "decision_dks_links_dks_entry_id_idx" ON "decision_dks_links"("dks_entry_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_reps" ADD CONSTRAINT "agent_reps_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "functional_agents" ADD CONSTRAINT "functional_agents_agent_rep_id_fkey" FOREIGN KEY ("agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "governance_agents" ADD CONSTRAINT "governance_agents_agent_rep_id_fkey" FOREIGN KEY ("agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_requests" ADD CONSTRAINT "content_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "content_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "draft_versions" ADD CONSTRAINT "draft_versions_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_events" ADD CONSTRAINT "approval_events_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_events" ADD CONSTRAINT "schedule_events_content_item_id_fkey" FOREIGN KEY ("content_item_id") REFERENCES "content_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saif_decision_records" ADD CONSTRAINT "saif_decision_records_human_user_id_fkey" FOREIGN KEY ("human_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saif_decision_records" ADD CONSTRAINT "saif_decision_records_agent_rep_id_fkey" FOREIGN KEY ("agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saif_decision_records" ADD CONSTRAINT "saif_decision_records_authority_user_id_fkey" FOREIGN KEY ("authority_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saif_decision_records" ADD CONSTRAINT "saif_decision_records_authority_agent_rep_id_fkey" FOREIGN KEY ("authority_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saif_decision_records" ADD CONSTRAINT "saif_decision_records_parent_decision_id_fkey" FOREIGN KEY ("parent_decision_id") REFERENCES "saif_decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_role_assignments" ADD CONSTRAINT "decision_role_assignments_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "saif_decision_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_role_assignments" ADD CONSTRAINT "decision_role_assignments_human_user_id_fkey" FOREIGN KEY ("human_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_role_assignments" ADD CONSTRAINT "decision_role_assignments_agent_rep_id_fkey" FOREIGN KEY ("agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_role_assignments" ADD CONSTRAINT "decision_role_assignments_functional_agent_id_fkey" FOREIGN KEY ("functional_agent_id") REFERENCES "functional_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_role_assignments" ADD CONSTRAINT "decision_role_assignments_governance_agent_id_fkey" FOREIGN KEY ("governance_agent_id") REFERENCES "governance_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_evaluations" ADD CONSTRAINT "decision_evaluations_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "saif_decision_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_execution_handoffs" ADD CONSTRAINT "decision_execution_handoffs_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "saif_decision_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_execution_handoffs" ADD CONSTRAINT "decision_execution_handoffs_handoff_to_agent_rep_id_fkey" FOREIGN KEY ("handoff_to_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_dks_links" ADD CONSTRAINT "decision_dks_links_decision_id_fkey" FOREIGN KEY ("decision_id") REFERENCES "saif_decision_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_dks_links" ADD CONSTRAINT "decision_dks_links_dks_entry_id_fkey" FOREIGN KEY ("dks_entry_id") REFERENCES "dks_entries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
