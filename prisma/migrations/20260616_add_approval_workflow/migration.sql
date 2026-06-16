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
