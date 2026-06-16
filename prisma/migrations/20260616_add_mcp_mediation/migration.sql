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
