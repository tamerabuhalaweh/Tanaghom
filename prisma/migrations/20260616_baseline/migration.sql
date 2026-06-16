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
