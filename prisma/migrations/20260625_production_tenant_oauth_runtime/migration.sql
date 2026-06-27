DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TenantStatus') THEN
    CREATE TYPE "TenantStatus" AS ENUM ('active', 'suspended', 'archived');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SocialConnectionStatus') THEN
    CREATE TYPE "SocialConnectionStatus" AS ENUM ('connected', 'expired', 'revoked', 'failed');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LangGraphWorkflowStatus') THEN
    CREATE TYPE "LangGraphWorkflowStatus" AS ENUM ('running', 'interrupted', 'completed', 'failed');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "tenants" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" "TenantStatus" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenants_tenant_key_key" ON "tenants"("tenant_key");

ALTER TABLE "users"
ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS "users_tenant_key_idx" ON "users"("tenant_key");

INSERT INTO "tenants" ("tenant_key", "name", "status")
SELECT DISTINCT COALESCE("users"."tenant_key", 'default'), 'Tanaghum Default Tenant', 'active'::"TenantStatus"
FROM "users"
ON CONFLICT ("tenant_key") DO NOTHING;

INSERT INTO "tenants" ("tenant_key", "name", "status")
VALUES ('default', 'Tanaghum Default Tenant', 'active'::"TenantStatus")
ON CONFLICT ("tenant_key") DO NOTHING;

CREATE TABLE IF NOT EXISTS "tenant_memberships" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "Role" NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_memberships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_memberships_tenant_key_user_id_key" ON "tenant_memberships"("tenant_key", "user_id");
CREATE INDEX IF NOT EXISTS "tenant_memberships_tenant_key_idx" ON "tenant_memberships"("tenant_key");
CREATE INDEX IF NOT EXISTS "tenant_memberships_user_id_idx" ON "tenant_memberships"("user_id");

INSERT INTO "tenant_memberships" ("tenant_key", "user_id", "role", "is_active")
SELECT COALESCE("users"."tenant_key", 'default'), "users"."id", "users"."role", "users"."is_active"
FROM "users"
ON CONFLICT ("tenant_key", "user_id") DO UPDATE
SET "role" = EXCLUDED."role",
    "is_active" = EXCLUDED."is_active",
    "updated_at" = CURRENT_TIMESTAMP;

ALTER TABLE "users"
ADD CONSTRAINT "users_tenant_key_fkey"
FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_memberships"
ADD CONSTRAINT "tenant_memberships_tenant_key_fkey"
FOREIGN KEY ("tenant_key") REFERENCES "tenants"("tenant_key") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "tenant_memberships"
ADD CONSTRAINT "tenant_memberships_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "integration_credentials"
ADD COLUMN IF NOT EXISTS "connection_key" TEXT NOT NULL DEFAULT 'default';

DROP INDEX IF EXISTS "integration_credentials_tenant_key_provider_credential_type_key";

CREATE UNIQUE INDEX IF NOT EXISTS "integration_credentials_tenant_key_provider_credential_type_connection_key_key"
ON "integration_credentials"("tenant_key", "provider", "credential_type", "connection_key");

CREATE INDEX IF NOT EXISTS "integration_credentials_connection_key_idx" ON "integration_credentials"("connection_key");

CREATE TABLE IF NOT EXISTS "oauth_connection_states" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "state_hash" TEXT NOT NULL,
  "redirect_uri" TEXT NOT NULL,
  "requested_scopes" TEXT[],
  "requester_user_id" UUID NOT NULL,
  "code_verifier" TEXT,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "oauth_connection_states_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "oauth_connection_states_state_hash_key" ON "oauth_connection_states"("state_hash");
CREATE INDEX IF NOT EXISTS "oauth_connection_states_tenant_key_idx" ON "oauth_connection_states"("tenant_key");
CREATE INDEX IF NOT EXISTS "oauth_connection_states_platform_idx" ON "oauth_connection_states"("platform");
CREATE INDEX IF NOT EXISTS "oauth_connection_states_expires_at_idx" ON "oauth_connection_states"("expires_at");

ALTER TABLE "oauth_connection_states"
ADD CONSTRAINT "oauth_connection_states_requester_user_id_fkey"
FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "social_account_connections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "tenant_key" TEXT NOT NULL,
  "platform" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "account_name" TEXT,
  "scopes" TEXT[],
  "encrypted_access_token" TEXT NOT NULL,
  "encrypted_refresh_token" TEXT,
  "token_expires_at" TIMESTAMP(3),
  "status" "SocialConnectionStatus" NOT NULL DEFAULT 'connected',
  "connected_by_user_id" UUID NOT NULL,
  "metadata" JSONB,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "social_account_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "social_account_connections_tenant_key_platform_account_id_key"
ON "social_account_connections"("tenant_key", "platform", "account_id");

CREATE INDEX IF NOT EXISTS "social_account_connections_tenant_key_idx" ON "social_account_connections"("tenant_key");
CREATE INDEX IF NOT EXISTS "social_account_connections_platform_idx" ON "social_account_connections"("platform");
CREATE INDEX IF NOT EXISTS "social_account_connections_status_idx" ON "social_account_connections"("status");

ALTER TABLE "social_account_connections"
ADD CONSTRAINT "social_account_connections_connected_by_user_id_fkey"
FOREIGN KEY ("connected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "langgraph_workflows" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "thread_id" TEXT NOT NULL,
  "tenant_key" TEXT NOT NULL,
  "workflow_type" TEXT NOT NULL,
  "status" "LangGraphWorkflowStatus" NOT NULL DEFAULT 'running',
  "human_user_id" UUID NOT NULL,
  "checkpoint_strategy" TEXT NOT NULL DEFAULT 'database_state_snapshot',
  "state_snapshot" JSONB NOT NULL,
  "interrupt_payload" JSONB,
  "result_payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "langgraph_workflows_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "langgraph_workflows_thread_id_key" ON "langgraph_workflows"("thread_id");
CREATE INDEX IF NOT EXISTS "langgraph_workflows_tenant_key_idx" ON "langgraph_workflows"("tenant_key");
CREATE INDEX IF NOT EXISTS "langgraph_workflows_workflow_type_idx" ON "langgraph_workflows"("workflow_type");
CREATE INDEX IF NOT EXISTS "langgraph_workflows_status_idx" ON "langgraph_workflows"("status");

ALTER TABLE "langgraph_workflows"
ADD CONSTRAINT "langgraph_workflows_human_user_id_fkey"
FOREIGN KEY ("human_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
