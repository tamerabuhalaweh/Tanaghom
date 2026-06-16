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
