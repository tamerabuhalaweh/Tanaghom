CREATE TYPE "LlmProviderType" AS ENUM ('openai', 'claude');

CREATE TABLE "llm_provider_credentials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "owner_user_id" UUID NOT NULL,
    "provider" "LlmProviderType" NOT NULL,
    "model" TEXT NOT NULL,
    "encrypted_api_key" TEXT NOT NULL,
    "key_fingerprint" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "llm_provider_credentials_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "llm_provider_credentials_owner_user_id_provider_key" ON "llm_provider_credentials"("owner_user_id", "provider");
CREATE INDEX "llm_provider_credentials_owner_user_id_idx" ON "llm_provider_credentials"("owner_user_id");

ALTER TABLE "llm_provider_credentials"
ADD CONSTRAINT "llm_provider_credentials_owner_user_id_fkey"
FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
