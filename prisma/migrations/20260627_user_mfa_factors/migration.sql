CREATE TYPE "MfaFactorType" AS ENUM ('totp');

CREATE TABLE "user_mfa_factors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "factor_type" "MfaFactorType" NOT NULL DEFAULT 'totp',
  "encrypted_secret" TEXT NOT NULL,
  "secret_fingerprint" TEXT NOT NULL,
  "label" TEXT,
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "enabled_at" TIMESTAMP(3),
  "disabled_at" TIMESTAMP(3),
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "user_mfa_factors_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_mfa_factors_user_id_idx" ON "user_mfa_factors"("user_id");
CREATE INDEX "user_mfa_factors_is_verified_idx" ON "user_mfa_factors"("is_verified");

ALTER TABLE "user_mfa_factors"
ADD CONSTRAINT "user_mfa_factors_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
