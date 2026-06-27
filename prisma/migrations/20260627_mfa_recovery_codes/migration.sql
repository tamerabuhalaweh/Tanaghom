-- Add one-time MFA recovery codes.
-- Raw recovery codes are never stored. The application stores only a salted hash
-- and returns raw codes once when a verified user generates them.

CREATE TABLE "user_mfa_recovery_codes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "code_hash" TEXT NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "user_mfa_recovery_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_mfa_recovery_codes_code_hash_key" ON "user_mfa_recovery_codes"("code_hash");
CREATE INDEX "user_mfa_recovery_codes_user_id_idx" ON "user_mfa_recovery_codes"("user_id");
CREATE INDEX "user_mfa_recovery_codes_used_at_idx" ON "user_mfa_recovery_codes"("used_at");

ALTER TABLE "user_mfa_recovery_codes"
ADD CONSTRAINT "user_mfa_recovery_codes_user_id_fkey"
FOREIGN KEY ("user_id")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
