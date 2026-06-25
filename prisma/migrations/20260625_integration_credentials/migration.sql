CREATE TABLE "integration_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_key" TEXT NOT NULL DEFAULT 'default',
    "provider" TEXT NOT NULL,
    "credential_type" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "encrypted_payload" JSONB NOT NULL,
    "secret_fingerprints" JSONB NOT NULL,
    "metadata" JSONB,
    "created_by_user_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_validated_at" TIMESTAMP(3),

    CONSTRAINT "integration_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "integration_credentials_tenant_key_provider_credential_type_key"
ON "integration_credentials"("tenant_key", "provider", "credential_type");

CREATE INDEX "integration_credentials_tenant_key_idx" ON "integration_credentials"("tenant_key");
CREATE INDEX "integration_credentials_provider_idx" ON "integration_credentials"("provider");
CREATE INDEX "integration_credentials_is_active_idx" ON "integration_credentials"("is_active");

ALTER TABLE "integration_credentials"
ADD CONSTRAINT "integration_credentials_created_by_user_id_fkey"
FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
