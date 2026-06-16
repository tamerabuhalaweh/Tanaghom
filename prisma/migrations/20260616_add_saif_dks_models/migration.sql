-- CreateTable
CREATE TABLE "saif_decision_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" TEXT NOT NULL,
    "description" TEXT,
    "decision_scope" TEXT NOT NULL,
    "complexity" TEXT DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "parent_decision_id" UUID,
    "human_user_id" UUID NOT NULL,
    "agent_rep_id" UUID NOT NULL,
    "authority_user_id" UUID,
    "authority_agent_rep_id" UUID,
    "rationale" TEXT,
    "alternatives_considered" TEXT,
    "confidence" TEXT NOT NULL DEFAULT 'low',
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
    "role" TEXT NOT NULL,
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
    "dimension" TEXT NOT NULL,
    "rating" TEXT NOT NULL,
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
    "handoff_status" TEXT NOT NULL DEFAULT 'pending',
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
    "source_type" TEXT NOT NULL DEFAULT 'team_decision',
    "version" TEXT DEFAULT '1.0',
    "confidence" TEXT NOT NULL DEFAULT 'low',
    "last_reviewed_at" TIMESTAMP(3),
    "freshness_status" TEXT NOT NULL DEFAULT 'unknown',
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
