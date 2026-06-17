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
    "source_id" UUID NOT NULL,
    "ingestion_request_id" UUID,
    "campaign_id" UUID,
    "content_item_id" UUID,
    "publishing_package_id" UUID,
    "postiz_publishing_job_id" UUID,
    "platform" TEXT,
    "reporting_period_id" UUID,
    "metrics" JSONB NOT NULL,
    "normalized_metrics" JSONB NOT NULL,
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "source_freshness" TEXT,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- CreateEnum
CREATE TYPE "ApprovalTargetType" AS ENUM ('campaign', 'content_item', 'draft_version', 'saif_decision_record');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'rejected', 'changes_requested', 'escalated', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('department_review', 'brand_review', 'compliance_review', 'cco_review', 'demand_generation_review', 'conversion_review', 'customer_growth_review', 'revenue_operations_review');

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_type" "ApprovalTargetType" NOT NULL,
    "target_id" UUID NOT NULL,
    "saif_decision_record_id" UUID,
    "requester_user_id" UUID NOT NULL,
    "requester_agent_rep_id" UUID NOT NULL,
    "approver_user_id" UUID,
    "approver_agent_rep_id" UUID,
    "approval_type" "ApprovalType" NOT NULL DEFAULT 'department_review',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "decision" TEXT,
    "comment" TEXT,
    "rationale" TEXT,
    "risk_category" TEXT NOT NULL DEFAULT 'low',
    "required_department" TEXT,
    "required_role" TEXT,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "escalated_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "approvals_target_type_target_id_idx" ON "approvals"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "approvals_approval_status_idx" ON "approvals"("approval_status");

-- CreateIndex
CREATE INDEX "approvals_requester_user_id_idx" ON "approvals"("requester_user_id");

-- CreateIndex
CREATE INDEX "approvals_approver_user_id_idx" ON "approvals"("approver_user_id");

-- CreateIndex
CREATE INDEX "approvals_required_department_idx" ON "approvals"("required_department");

-- CreateIndex
CREATE INDEX "approvals_risk_category_idx" ON "approvals"("risk_category");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requester_agent_rep_id_fkey" FOREIGN KEY ("requester_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_agent_rep_id_fkey" FOREIGN KEY ("approver_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_saif_decision_record_id_fkey" FOREIGN KEY ("saif_decision_record_id") REFERENCES "saif_decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('active', 'fulfilled', 'abandoned', 'superseded');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('active', 'achieved', 'failed', 'abandoned');

-- CreateEnum
CREATE TYPE "CapabilityRiskLevel" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "ResolutionStatus" AS ENUM ('pending', 'resolved', 'rejected', 'blocked', 'deferred');

-- CreateTable
CREATE TABLE "intents" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "source_type" TEXT,
    "created_by_user_id" UUID NOT NULL,
    "created_by_agent_rep_id" UUID NOT NULL,
    "status" "IntentStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "intents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objectives" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "intent_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "success_criteria" TEXT,
    "constraints" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capabilities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "owner_substrate" TEXT,
    "risk_level" "CapabilityRiskLevel" NOT NULL DEFAULT 'low',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "requires_saif_decision" BOOLEAN NOT NULL DEFAULT false,
    "allowed_agent_types" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capabilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "execution_patterns" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "capability_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "ordered_steps" JSONB NOT NULL,
    "required_inputs" TEXT[],
    "expected_outputs" TEXT[],
    "boundary_rules" JSONB,
    "m4_allowed" BOOLEAN NOT NULL DEFAULT true,
    "m5_required" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "execution_patterns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "canonical_owner" TEXT,
    "external_reference" TEXT,
    "sensitivity" TEXT,
    "access_rules" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implementations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "capability_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "implementation_type" TEXT NOT NULL,
    "provider" TEXT,
    "is_external" BOOLEAN NOT NULL DEFAULT false,
    "requires_mcp" BOOLEAN NOT NULL DEFAULT false,
    "m4_allowed" BOOLEAN NOT NULL DEFAULT true,
    "m5_allowed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "implementations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "implementation_resources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "implementation_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "access_type" TEXT NOT NULL DEFAULT 'read',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "implementation_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "capability_resolutions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "intent_id" UUID NOT NULL,
    "objective_id" UUID NOT NULL,
    "capability_id" UUID NOT NULL,
    "execution_pattern_id" UUID NOT NULL,
    "implementation_id" UUID NOT NULL,
    "saif_decision_record_id" UUID,
    "human_user_id" UUID NOT NULL,
    "agent_rep_id" UUID NOT NULL,
    "resolution_status" "ResolutionStatus" NOT NULL DEFAULT 'pending',
    "rationale" TEXT,
    "constraints_applied" JSONB,
    "rejected_alternatives" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "capability_resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "capabilities_name_key" ON "capabilities"("name");

-- CreateIndex
CREATE UNIQUE INDEX "resources_name_key" ON "resources"("name");

-- CreateIndex
CREATE INDEX "intents_status_idx" ON "intents"("status");

-- CreateIndex
CREATE INDEX "intents_created_by_user_id_idx" ON "intents"("created_by_user_id");

-- CreateIndex
CREATE INDEX "objectives_intent_id_idx" ON "objectives"("intent_id");

-- CreateIndex
CREATE INDEX "objectives_status_idx" ON "objectives"("status");

-- CreateIndex
CREATE INDEX "capabilities_category_idx" ON "capabilities"("category");

-- CreateIndex
CREATE INDEX "capabilities_risk_level_idx" ON "capabilities"("risk_level");

-- CreateIndex
CREATE INDEX "execution_patterns_capability_id_idx" ON "execution_patterns"("capability_id");

-- CreateIndex
CREATE INDEX "resources_resource_type_idx" ON "resources"("resource_type");

-- CreateIndex
CREATE INDEX "implementations_capability_id_idx" ON "implementations"("capability_id");

-- CreateIndex
CREATE INDEX "implementations_status_idx" ON "implementations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "implementation_resources_implementation_id_resource_id_key" ON "implementation_resources"("implementation_id", "resource_id");

-- CreateIndex
CREATE INDEX "capability_resolutions_intent_id_idx" ON "capability_resolutions"("intent_id");

-- CreateIndex
CREATE INDEX "capability_resolutions_objective_id_idx" ON "capability_resolutions"("objective_id");

-- CreateIndex
CREATE INDEX "capability_resolutions_capability_id_idx" ON "capability_resolutions"("capability_id");

-- CreateIndex
CREATE INDEX "capability_resolutions_resolution_status_idx" ON "capability_resolutions"("resolution_status");

-- CreateIndex
CREATE INDEX "capability_resolutions_human_user_id_idx" ON "capability_resolutions"("human_user_id");

-- AddForeignKey
ALTER TABLE "intents" ADD CONSTRAINT "intents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "intents" ADD CONSTRAINT "intents_created_by_agent_rep_id_fkey" FOREIGN KEY ("created_by_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objectives" ADD CONSTRAINT "objectives_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "execution_patterns" ADD CONSTRAINT "execution_patterns_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementations" ADD CONSTRAINT "implementations_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_resources" ADD CONSTRAINT "implementation_resources_implementation_id_fkey" FOREIGN KEY ("implementation_id") REFERENCES "implementations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "implementation_resources" ADD CONSTRAINT "implementation_resources_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_intent_id_fkey" FOREIGN KEY ("intent_id") REFERENCES "intents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_objective_id_fkey" FOREIGN KEY ("objective_id") REFERENCES "objectives"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_execution_pattern_id_fkey" FOREIGN KEY ("execution_pattern_id") REFERENCES "execution_patterns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_implementation_id_fkey" FOREIGN KEY ("implementation_id") REFERENCES "implementations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_saif_decision_record_id_fkey" FOREIGN KEY ("saif_decision_record_id") REFERENCES "saif_decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_human_user_id_fkey" FOREIGN KEY ("human_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "capability_resolutions" ADD CONSTRAINT "capability_resolutions_agent_rep_id_fkey" FOREIGN KEY ("agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "McpConnectorStatus" AS ENUM ('active', 'inactive', 'suspended', 'planned');

-- CreateEnum
CREATE TYPE "McpMediationRequestStatus" AS ENUM ('pending', 'approved', 'denied', 'deferred', 'escalated', 'blocked');

-- CreateEnum
CREATE TYPE "McpMediationDecisionType" AS ENUM ('allow', 'deny', 'defer', 'escalate', 'blocked_m5', 'blocked_missing_approval', 'blocked_missing_saif', 'blocked_direct_access', 'blocked_inactive_connector', 'blocked_suspended_credential');

-- CreateEnum
CREATE TYPE "McpCredentialStatus" AS ENUM ('active', 'inactive', 'suspended', 'placeholder');

-- CreateTable
CREATE TABLE "mcp_connectors" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "connector_type" TEXT NOT NULL,
    "target_system" TEXT NOT NULL,
    "status" "McpConnectorStatus" NOT NULL DEFAULT 'planned',
    "is_external" BOOLEAN NOT NULL DEFAULT true,
    "supports_read" BOOLEAN NOT NULL DEFAULT true,
    "supports_write" BOOLEAN NOT NULL DEFAULT false,
    "m4_allowed" BOOLEAN NOT NULL DEFAULT true,
    "m5_allowed" BOOLEAN NOT NULL DEFAULT false,
    "credential_required" BOOLEAN NOT NULL DEFAULT true,
    "owner_substrate" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_connectors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_capability_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "capability_id" UUID NOT NULL,
    "implementation_id" UUID,
    "mcp_connector_id" UUID NOT NULL,
    "allowed_operation" TEXT NOT NULL DEFAULT 'read',
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "requires_saif_decision" BOOLEAN NOT NULL DEFAULT false,
    "requires_m5_authorization" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_capability_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_mediation_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "capability_resolution_id" UUID,
    "mcp_connector_id" UUID NOT NULL,
    "requested_operation" TEXT NOT NULL,
    "resource_ids" TEXT[],
    "human_user_id" UUID NOT NULL,
    "agent_rep_id" UUID NOT NULL,
    "acting_agent_type" TEXT NOT NULL,
    "acting_agent_id" TEXT,
    "saif_decision_record_id" UUID,
    "approval_id" UUID,
    "request_status" "McpMediationRequestStatus" NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_mediation_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_mediation_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mediation_request_id" UUID NOT NULL,
    "decision" "McpMediationDecisionType" NOT NULL,
    "rationale" TEXT,
    "policy_matched" TEXT,
    "decided_by_user_id" UUID,
    "decided_by_agent_rep_id" UUID,
    "decided_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mcp_mediation_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_access_policies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "connector_type" TEXT,
    "operation_type" TEXT,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "requires_m4" BOOLEAN NOT NULL DEFAULT true,
    "requires_m5" BOOLEAN NOT NULL DEFAULT false,
    "requires_saif_decision" BOOLEAN NOT NULL DEFAULT false,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "conditions" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_access_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mcp_credential_bindings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "mcp_connector_id" UUID NOT NULL,
    "scope" TEXT,
    "status" "McpCredentialStatus" NOT NULL DEFAULT 'placeholder',
    "secret_ref_placeholder" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mcp_credential_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mcp_connectors_name_key" ON "mcp_connectors"("name");

-- CreateIndex
CREATE INDEX "mcp_connectors_status_idx" ON "mcp_connectors"("status");

-- CreateIndex
CREATE INDEX "mcp_connectors_connector_type_idx" ON "mcp_connectors"("connector_type");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_capability_bindings_capability_id_implementation_id_mcp_key" ON "mcp_capability_bindings"("capability_id", "implementation_id", "mcp_connector_id");

-- CreateIndex
CREATE INDEX "mcp_capability_bindings_capability_id_idx" ON "mcp_capability_bindings"("capability_id");

-- CreateIndex
CREATE INDEX "mcp_capability_bindings_mcp_connector_id_idx" ON "mcp_capability_bindings"("mcp_connector_id");

-- CreateIndex
CREATE INDEX "mcp_mediation_requests_mcp_connector_id_idx" ON "mcp_mediation_requests"("mcp_connector_id");

-- CreateIndex
CREATE INDEX "mcp_mediation_requests_request_status_idx" ON "mcp_mediation_requests"("request_status");

-- CreateIndex
CREATE INDEX "mcp_mediation_requests_human_user_id_idx" ON "mcp_mediation_requests"("human_user_id");

-- CreateIndex
CREATE INDEX "mcp_mediation_decisions_mediation_request_id_idx" ON "mcp_mediation_decisions"("mediation_request_id");

-- CreateIndex
CREATE INDEX "mcp_mediation_decisions_decision_idx" ON "mcp_mediation_decisions"("decision");

-- CreateIndex
CREATE UNIQUE INDEX "mcp_access_policies_name_key" ON "mcp_access_policies"("name");

-- CreateIndex
CREATE INDEX "mcp_access_policies_connector_type_idx" ON "mcp_access_policies"("connector_type");

-- CreateIndex
CREATE INDEX "mcp_credential_bindings_mcp_connector_id_idx" ON "mcp_credential_bindings"("mcp_connector_id");

-- CreateIndex
CREATE INDEX "mcp_credential_bindings_status_idx" ON "mcp_credential_bindings"("status");

-- AddForeignKey
ALTER TABLE "mcp_capability_bindings" ADD CONSTRAINT "mcp_capability_bindings_capability_id_fkey" FOREIGN KEY ("capability_id") REFERENCES "capabilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_capability_bindings" ADD CONSTRAINT "mcp_capability_bindings_implementation_id_fkey" FOREIGN KEY ("implementation_id") REFERENCES "implementations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_capability_bindings" ADD CONSTRAINT "mcp_capability_bindings_mcp_connector_id_fkey" FOREIGN KEY ("mcp_connector_id") REFERENCES "mcp_connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_requests" ADD CONSTRAINT "mcp_mediation_requests_capability_resolution_id_fkey" FOREIGN KEY ("capability_resolution_id") REFERENCES "capability_resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_requests" ADD CONSTRAINT "mcp_mediation_requests_mcp_connector_id_fkey" FOREIGN KEY ("mcp_connector_id") REFERENCES "mcp_connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_requests" ADD CONSTRAINT "mcp_mediation_requests_human_user_id_fkey" FOREIGN KEY ("human_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_requests" ADD CONSTRAINT "mcp_mediation_requests_agent_rep_id_fkey" FOREIGN KEY ("agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_requests" ADD CONSTRAINT "mcp_mediation_requests_saif_decision_record_id_fkey" FOREIGN KEY ("saif_decision_record_id") REFERENCES "saif_decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_requests" ADD CONSTRAINT "mcp_mediation_requests_approval_id_fkey" FOREIGN KEY ("approval_id") REFERENCES "approvals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_decisions" ADD CONSTRAINT "mcp_mediation_decisions_mediation_request_id_fkey" FOREIGN KEY ("mediation_request_id") REFERENCES "mcp_mediation_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_decisions" ADD CONSTRAINT "mcp_mediation_decisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_mediation_decisions" ADD CONSTRAINT "mcp_mediation_decisions_decided_by_agent_rep_id_fkey" FOREIGN KEY ("decided_by_agent_rep_id") REFERENCES "agent_reps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mcp_credential_bindings" ADD CONSTRAINT "mcp_credential_bindings_mcp_connector_id_fkey" FOREIGN KEY ("mcp_connector_id") REFERENCES "mcp_connectors"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
ALTER TABLE "surface_tasks" ADD CONSTRAINT "surface_tasks_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surface_status_projections" ADD CONSTRAINT "surface_status_projections_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surface_relay_events" ADD CONSTRAINT "surface_relay_events_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "surface_sync_policies" ADD CONSTRAINT "surface_sync_policies_operating_surface_id_fkey" FOREIGN KEY ("operating_surface_id") REFERENCES "operating_surfaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- CreateIndex
CREATE INDEX "analytics_snapshots_source_id_idx" ON "analytics_snapshots"("source_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_campaign_id_idx" ON "analytics_snapshots"("campaign_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_content_item_id_idx" ON "analytics_snapshots"("content_item_id");

-- CreateIndex
CREATE INDEX "analytics_snapshots_collected_at_idx" ON "analytics_snapshots"("collected_at");

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "analytics_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analytics_snapshots" ADD CONSTRAINT "analytics_snapshots_ingestion_request_id_fkey" FOREIGN KEY ("ingestion_request_id") REFERENCES "analytics_ingestion_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_performance_reports" ADD CONSTRAINT "campaign_performance_reports_reporting_period_id_fkey" FOREIGN KEY ("reporting_period_id") REFERENCES "reporting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'under_review', 'accepted', 'rejected', 'needs_more_evidence', 'superseded');

-- CreateEnum
CREATE TYPE "ProposalType" AS ENUM ('create_new_entry', 'update_existing_entry', 'mark_stale', 'increase_confidence', 'decrease_confidence', 'add_relationship', 'deprecate_entry');

-- CreateEnum
CREATE TYPE "ProposalStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'deferred', 'requires_saif_review', 'applied');

-- CreateEnum
CREATE TYPE "DksDecisionType" AS ENUM ('approved', 'rejected', 'deferred', 'requires_saif_review');

-- CreateTable
CREATE TABLE "learning_signal_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_signal_id" UUID NOT NULL,
    "review_status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "reviewer_user_id" UUID,
    "reviewer_agent_rep_id" UUID,
    "review_decision" TEXT,
    "review_rationale" TEXT,
    "confidence_assessment" TEXT,
    "risk_assessment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_signal_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dks_update_proposals" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "learning_signal_id" UUID NOT NULL,
    "learning_signal_review_id" UUID,
    "target_dks_entry_id" UUID,
    "proposal_type" "ProposalType" NOT NULL,
    "proposed_title" TEXT,
    "proposed_summary" TEXT,
    "proposed_tags" TEXT[],
    "proposed_confidence" TEXT,
    "proposed_freshness_status" TEXT,
    "proposed_source" TEXT,
    "proposed_source_type" TEXT,
    "proposed_version_change" TEXT,
    "rationale" TEXT,
    "proposal_status" "ProposalStatus" NOT NULL DEFAULT 'draft',
    "created_by_user_id" UUID NOT NULL,
    "created_by_agent_rep_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dks_update_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dks_update_decisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dks_update_proposal_id" UUID NOT NULL,
    "authority_user_id" UUID NOT NULL,
    "authority_agent_rep_id" UUID NOT NULL,
    "decision" "DksDecisionType" NOT NULL,
    "rationale" TEXT,
    "risk_acceptance" TEXT,
    "applied_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dks_update_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "dks_entry_id" UUID NOT NULL,
    "dks_update_proposal_id" UUID,
    "previous_version" TEXT,
    "new_version" TEXT NOT NULL,
    "changed_fields" JSONB,
    "revision_summary" TEXT,
    "applied_by_user_id" UUID NOT NULL,
    "applied_by_agent_rep_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_signal_reviews_learning_signal_id_idx" ON "learning_signal_reviews"("learning_signal_id");

-- CreateIndex
CREATE INDEX "learning_signal_reviews_review_status_idx" ON "learning_signal_reviews"("review_status");

-- CreateIndex
CREATE INDEX "learning_signal_reviews_reviewer_user_id_idx" ON "learning_signal_reviews"("reviewer_user_id");

-- CreateIndex
CREATE INDEX "dks_update_proposals_learning_signal_id_idx" ON "dks_update_proposals"("learning_signal_id");

-- CreateIndex
CREATE INDEX "dks_update_proposals_proposal_status_idx" ON "dks_update_proposals"("proposal_status");

-- CreateIndex
CREATE INDEX "dks_update_proposals_created_by_user_id_idx" ON "dks_update_proposals"("created_by_user_id");

-- CreateIndex
CREATE INDEX "dks_update_decisions_dks_update_proposal_id_idx" ON "dks_update_decisions"("dks_update_proposal_id");

-- CreateIndex
CREATE INDEX "dks_update_decisions_decision_idx" ON "dks_update_decisions"("decision");

-- CreateIndex
CREATE INDEX "knowledge_revisions_dks_entry_id_idx" ON "knowledge_revisions"("dks_entry_id");

-- CreateIndex
CREATE INDEX "knowledge_revisions_dks_update_proposal_id_idx" ON "knowledge_revisions"("dks_update_proposal_id");

-- AddForeignKey
ALTER TABLE "dks_update_decisions" ADD CONSTRAINT "dks_update_decisions_dks_update_proposal_id_fkey" FOREIGN KEY ("dks_update_proposal_id") REFERENCES "dks_update_proposals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
