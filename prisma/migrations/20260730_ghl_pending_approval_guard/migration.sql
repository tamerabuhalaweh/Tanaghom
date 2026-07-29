CREATE UNIQUE INDEX "approvals_one_pending_external_operation_key"
  ON "approvals"("tenant_key", "target_id")
  WHERE "target_type" = 'external_operation' AND "approval_status" = 'pending';
