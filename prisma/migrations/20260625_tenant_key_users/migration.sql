ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tenant_key" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS "users_tenant_key_idx" ON "users"("tenant_key");
