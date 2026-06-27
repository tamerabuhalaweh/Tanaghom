CREATE TYPE "OnboardingTokenPurpose" AS ENUM ('invite', 'password_reset');

CREATE TABLE "user_onboarding_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "purpose" "OnboardingTokenPurpose" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_onboarding_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_onboarding_tokens_token_hash_key" ON "user_onboarding_tokens"("token_hash");
CREATE INDEX "user_onboarding_tokens_user_id_idx" ON "user_onboarding_tokens"("user_id");
CREATE INDEX "user_onboarding_tokens_purpose_idx" ON "user_onboarding_tokens"("purpose");
CREATE INDEX "user_onboarding_tokens_expires_at_idx" ON "user_onboarding_tokens"("expires_at");

ALTER TABLE "user_onboarding_tokens"
ADD CONSTRAINT "user_onboarding_tokens_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
