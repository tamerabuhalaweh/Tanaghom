ALTER TABLE "users" ADD COLUMN "tenant_key" TEXT NOT NULL DEFAULT 'default';

CREATE INDEX "users_tenant_key_idx" ON "users"("tenant_key");
