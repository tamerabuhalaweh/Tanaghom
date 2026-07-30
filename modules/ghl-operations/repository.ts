import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type GhlOperationCommand, type LeadCaptureRecord } from '@prisma/client';
import { prisma } from '@shared/database';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '@shared/errors';
import { evaluateExternalExecution } from '@shared/policy/external-execution';
import { getApprovedMappingForEvent } from '../ghl-plan-attribution/repository';
import { getGhlMappingReadiness } from '../ghl-setup/repository';
import { resolveGhlSyncRuntimeConfig, type GhlRuntimeConfig } from '../ghl-sync/repository';
import type {
  GhlOperationsClient,
  GhlOperationsReferenceData,
  GhlOpportunityFieldReference,
} from './client';
import { extractProviderIds, isGhlWhatsAppDnd, summarizeGhlProviderError } from './client';
import { operationRuntimeBlocker } from './runtime';
import { assertGhlOperationTransition } from './state-machine';
import { ghlOperationActionSchema, paidSaleRequiresWon } from './types';
import type {
  DecideGhlOperationInput,
  ExecuteGhlOperationInput,
  GhlOperationAction,
  GhlOperationStatus,
  GhlOperationSummary,
  GhlProviderResult,
  ListGhlOperationsInput,
  PrepareGhlOperationInput,
  ReconcileGhlOperationInput,
  SubmitGhlOperationInput,
} from './types';
import {
  approveOperationGovernance,
  createOperationApproval,
  rejectOperationApproval,
} from './governance';

type ClientFactory = (config: GhlRuntimeConfig) => GhlOperationsClient;
type JsonRecord = Record<string, unknown>;

const PREVIEW_LIFETIME_MS = 24 * 60 * 60 * 1000;
const IDEMPOTENCY_WINDOW_MS = 15 * 60 * 1000;
const EXECUTION_LEASE_MS = 2 * 60 * 1000;

export async function listOperations(
  tenantKey: string,
  filters: ListGhlOperationsInput,
): Promise<GhlOperationSummary[]> {
  const records = await prisma.ghlOperationCommand.findMany({
    where: {
      tenant_key: tenantKey,
      ...(filters.eventId ? { event_id: filters.eventId } : {}),
      ...(filters.leadId ? { lead_id: filters.leadId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.type ? { operation_type: filters.type } : {}),
    },
    orderBy: { created_at: 'desc' },
    take: filters.limit,
  });
  return records.map(serialize);
}

export async function getOperation(tenantKey: string, id: string): Promise<GhlOperationSummary> {
  return serialize(await getRecord(tenantKey, id));
}

export async function getWebhookReadiness(tenantKey: string): Promise<{
  verifiedEventCount: number;
  lastVerifiedAt: Date | null;
}> {
  const [verifiedEventCount, latest] = await Promise.all([
    prisma.ghlWebhookEvent.count({
      where: { tenant_key: tenantKey, signature_verified: true },
    }),
    prisma.ghlWebhookEvent.findFirst({
      where: { tenant_key: tenantKey, signature_verified: true },
      orderBy: { received_at: 'desc' },
      select: { received_at: true },
    }),
  ]);
  return {
    verifiedEventCount,
    lastVerifiedAt: latest?.received_at ?? null,
  };
}

export async function prepareOperation(
  tenantKey: string,
  userId: string,
  agentRepId: string,
  input: PrepareGhlOperationInput,
  providerReferences?: GhlOperationsReferenceData,
): Promise<GhlOperationSummary> {
  const requestHash = hashJson({
    eventId: input.eventId ?? null,
    commercialPlanId: input.commercialPlanId ?? null,
    stitchiActionRunId: input.stitchiActionRunId ?? null,
    action: input.action,
  });
  const idempotencyWindow = Math.floor(Date.now() / IDEMPOTENCY_WINDOW_MS);
  const idempotencyKey = input.stitchiActionRunId
    ? `stitchi:${input.stitchiActionRunId}`
    : `ghl:${hashJson({
        tenantKey,
        userId,
        eventId: input.eventId ?? null,
        commercialPlanId: input.commercialPlanId ?? null,
        action: input.action,
        idempotencyWindow,
      })}`;
  const existing = await prisma.ghlOperationCommand.findUnique({
    where: {
      tenant_key_idempotency_key: {
        tenant_key: tenantKey,
        idempotency_key: idempotencyKey,
      },
    },
  });
  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new ConflictError(
        'An equivalent CRM operation is already prepared in this review window',
      );
    }
    return { ...serialize(existing), idempotent: true };
  }

  const context = await loadPreviewContext(tenantKey, userId, input);
  const preview = buildProviderPreview(
    context.config,
    context.lead,
    context.mapping,
    input.action,
    providerReferences,
  );
  const previewHash = hashJson(preview);
  const expiresAt = new Date(Date.now() + PREVIEW_LIFETIME_MS);
  const record = await prisma.$transaction(async (tx) => {
    const created = await tx.ghlOperationCommand.create({
      data: {
        tenant_key: tenantKey,
        event_id: input.eventId ?? context.lead.event_id,
        commercial_plan_id: input.commercialPlanId ?? context.lead.commercial_plan_id,
        lead_id: context.lead.id,
        stitchi_action_run_id: input.stitchiActionRunId ?? null,
        operation_type: input.action.type,
        status: 'previewed',
        reconciliation_status: 'pending',
        idempotency_key: idempotencyKey,
        request_hash: requestHash,
        preview_hash: previewHash,
        input_payload: input.action as unknown as Prisma.InputJsonValue,
        preview_payload: preview as Prisma.InputJsonValue,
        provider_endpoint: requiredString(preview.providerEndpoint, 'provider endpoint'),
        requested_by_user_id: userId,
        requested_by_agent_rep_id: agentRepId,
        expires_at: expiresAt,
      },
    });
    await audit(tx, userId, 'ghl_operation_previewed', created.id, 'success', {
      operationType: input.action.type,
      leadId: context.lead.id,
      eventId: input.eventId ?? context.lead.event_id,
      readyForApproval: preview.readyForApproval,
      blockers: preview.blockers,
      previewHash,
    });
    return created;
  });
  return serialize(record);
}

export async function submitOperation(
  tenantKey: string,
  userId: string,
  agentRepId: string,
  id: string,
  input: SubmitGhlOperationInput,
): Promise<GhlOperationSummary> {
  const record = await getRecord(tenantKey, id);
  if (record.requested_by_user_id !== userId) {
    throw new ForbiddenError('Only the user who prepared this CRM action may submit it');
  }
  assertVersionAndHash(record, input.expectedVersion, input.previewHash);
  assertNotExpired(record);
  assertGhlOperationTransition(record.status as GhlOperationStatus, 'pending_approval');
  const preview = asRecord(record.preview_payload);
  if (preview.readyForApproval !== true) {
    throw new ValidationError(
      `GHL operation is not ready for approval: ${asStringArray(preview.blockers).join('; ')}`,
    );
  }
  const updated = await prisma.$transaction(
    async (tx) => {
      const approval = await createOperationApproval({
        tx,
        tenantKey,
        operationId: id,
        operationType: record.operation_type,
        requesterUserId: userId,
        requesterAgentRepId: agentRepId,
        expiresAt: record.expires_at,
      });
      const result = await tx.ghlOperationCommand.updateMany({
        where: { id, tenant_key: tenantKey, status: 'previewed', version: input.expectedVersion },
        data: {
          status: 'pending_approval',
          approval_id: approval.id,
          version: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new ConflictError('GHL operation changed before submission');
      await audit(tx, userId, 'ghl_operation_submitted', id, 'success', {
        approvalId: approval.id,
        reason: input.reason,
      });
      return tx.ghlOperationCommand.findUniqueOrThrow({ where: { id } });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return serialize(updated);
}

export async function decideOperation(
  tenantKey: string,
  userId: string,
  agentRepId: string,
  id: string,
  input: DecideGhlOperationInput,
): Promise<GhlOperationSummary> {
  const record = await getRecord(tenantKey, id);
  assertVersionAndHash(record, input.expectedVersion, input.previewHash);
  assertNotExpired(record);
  if (!record.approval_id) throw new ConflictError('GHL operation has no approval request');
  if (record.status !== 'pending_approval') {
    throw new ConflictError(`GHL operation cannot be decided from ${record.status}`);
  }

  if (input.decision === 'reject') {
    const rejected = await prisma.$transaction(
      async (tx) => {
        await rejectOperationApproval({
          tx,
          tenantKey,
          operationId: id,
          approvalId: record.approval_id!,
          approverUserId: userId,
          approverAgentRepId: agentRepId,
          notes: input.notes,
        });
        return transitionWithAuditTx(
          tx,
          tenantKey,
          userId,
          record,
          'rejected',
          { approved_by_user_id: userId, approved_by_agent_rep_id: agentRepId },
          'ghl_operation_rejected',
          { notes: input.notes },
        );
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return serialize(rejected);
  }

  const approved = await prisma.$transaction(
    async (tx) => {
      const governance = await approveOperationGovernance({
        tx,
        tenantKey,
        operationId: id,
        operationType: record.operation_type,
        approvalId: record.approval_id!,
        requesterUserId: record.requested_by_user_id,
        requesterAgentRepId: record.requested_by_agent_rep_id,
        approverUserId: userId,
        approverAgentRepId: agentRepId,
        notes: input.notes,
      });
      return transitionWithAuditTx(
        tx,
        tenantKey,
        userId,
        record,
        'approved',
        {
          approved_by_user_id: userId,
          approved_by_agent_rep_id: agentRepId,
          approved_at: new Date(),
          capability_resolution_id: governance.capabilityResolutionId,
          mcp_mediation_request_id: governance.mcpMediationRequestId,
          mcp_mediation_decision_id: governance.mcpMediationDecisionId,
        },
        'ghl_operation_approved',
        { approvalId: governance.approvalId, notes: input.notes },
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  return serialize(approved);
}

export async function executeOperation(
  tenantKey: string,
  userId: string,
  id: string,
  input: ExecuteGhlOperationInput,
  clientFactory: ClientFactory,
): Promise<GhlOperationSummary> {
  const record = await getRecord(tenantKey, id);
  if (record.status === 'provider_accepted' || record.status === 'reconciled') {
    assertHash(record, input.previewHash);
    return { ...serialize(record), idempotent: true };
  }
  assertVersionAndHash(record, input.expectedVersion, input.previewHash);
  assertNotExpired(record);
  if (record.status !== 'approved') {
    throw new ConflictError(`GHL operation cannot execute from ${record.status}`);
  }

  const config = await resolveGhlSyncRuntimeConfig(tenantKey);
  const client = clientFactory(config);
  const gate = await buildExecutionGate(record, config, client);
  if (gate.length > 0) {
    await transitionWithAudit(
      tenantKey,
      userId,
      record,
      'blocked',
      { failure_reason: gate.join('; ') },
      'ghl_operation_blocked',
      { reasons: gate },
    );
    throw new ForbiddenError(`External execution blocked: ${gate.join('; ')}`);
  }

  const executing = await transitionWithAudit(
    tenantKey,
    userId,
    record,
    'executing',
    {
      attempt_count: { increment: 1 },
      execution_lease_id: randomUUID(),
      execution_lease_expires_at: new Date(Date.now() + EXECUTION_LEASE_MS),
    },
    'ghl_operation_execution_started',
    { operationType: record.operation_type },
  );
  try {
    const action = record.input_payload as unknown as GhlOperationAction;
    const preview = asRecord(record.preview_payload);
    const providerPayload = asRecord(preview.providerPayload);
    const response = await performProviderOperation(client, action, preview, providerPayload);
    if (!response.ok) {
      const providerError = summarizeGhlProviderError(response.body);
      const failed = await transitionWithAudit(
        tenantKey,
        userId,
        executing,
        'failed',
        {
          provider_response_status: response.status,
          failure_reason: [`GoHighLevel returned HTTP ${response.status}`, providerError]
            .filter(Boolean)
            .join(': '),
        },
        'ghl_operation_provider_failed',
        {
          status: response.status,
          ...(providerError ? { providerError } : {}),
          rawPayloadReturned: false,
        },
      );
      return serialize(failed);
    }
    const ids = extractProviderIds(response.body, action.type);
    const accepted = await prisma.$transaction(async (tx) => {
      const updated = await tx.ghlOperationCommand.update({
        where: { id },
        data: {
          status: 'provider_accepted',
          reconciliation_status: 'pending',
          provider_response_status: response.status,
          provider_result: {
            accepted: true,
            status: response.status,
            objectId: ids.objectId,
            rawPayloadReturned: false,
          },
          provider_object_id: ids.objectId,
          provider_contact_id:
            ids.contactId ||
            (action.type !== 'contact_upsert'
              ? String(providerPayload.contactId || '') || null
              : null),
          provider_opportunity_id:
            ids.opportunityId ||
            (action.type === 'opportunity_upsert'
              ? action.opportunityId ||
                (typeof preview.resolvedOpportunityId === 'string'
                  ? preview.resolvedOpportunityId
                  : null)
              : null),
          provider_appointment_id:
            ids.appointmentId ||
            (action.type === 'appointment_upsert' ? action.appointmentId || null : null),
          provider_message_id: ids.messageId,
          executed_at: new Date(),
          execution_lease_id: null,
          execution_lease_expires_at: null,
          version: { increment: 1 },
        },
      });
      await audit(tx, userId, 'ghl_operation_provider_accepted', id, 'success', {
        operationType: record.operation_type,
        providerStatus: response.status,
        providerObjectId: ids.objectId,
        rawPayloadReturned: false,
      });
      return updated;
    });
    return serialize(await reconcilePreviouslyReceivedMessageWebhook(accepted, userId));
  } catch (error) {
    const current = await getRecord(tenantKey, id);
    if (current.status === 'executing') {
      const failed = await transitionWithAudit(
        tenantKey,
        userId,
        current,
        'reconciliation_failed',
        {
          failure_reason:
            error instanceof Error
              ? `Provider outcome is uncertain: ${error.message}`
              : 'Provider outcome is uncertain',
          execution_lease_id: null,
          execution_lease_expires_at: null,
        },
        'ghl_operation_outcome_uncertain',
        { retryAutomatically: false },
      );
      return serialize(failed);
    }
    throw error;
  }
}

export async function recoverStaleExecutions(limit = 50): Promise<number> {
  const stale = await prisma.ghlOperationCommand.findMany({
    where: {
      status: 'executing',
      execution_lease_expires_at: { lte: new Date() },
    },
    orderBy: { execution_lease_expires_at: 'asc' },
    take: limit,
  });
  let recovered = 0;
  for (const record of stale) {
    try {
      await transitionWithAudit(
        record.tenant_key,
        record.requested_by_user_id,
        record,
        'reconciliation_failed',
        {
          reconciliation_status: 'failed',
          execution_lease_id: null,
          execution_lease_expires_at: null,
          failure_reason:
            'Execution lease expired. Provider outcome is uncertain; automatic retry is prohibited.',
        },
        'ghl_operation_execution_lease_expired',
        { retryAutomatically: false },
      );
      recovered += 1;
    } catch (error) {
      if (!(error instanceof ConflictError)) throw error;
    }
  }
  return recovered;
}

export async function listApprovedOperationIds(limit = 20): Promise<
  Array<{
    tenantKey: string;
    id: string;
    requestedByUserId: string;
    previewHash: string;
    version: number;
  }>
> {
  const rows = await prisma.ghlOperationCommand.findMany({
    where: { status: 'approved', expires_at: { gt: new Date() } },
    orderBy: { approved_at: 'asc' },
    take: limit,
    select: {
      tenant_key: true,
      id: true,
      requested_by_user_id: true,
      preview_hash: true,
      version: true,
    },
  });
  return rows.map((row) => ({
    tenantKey: row.tenant_key,
    id: row.id,
    requestedByUserId: row.requested_by_user_id,
    previewHash: row.preview_hash,
    version: row.version,
  }));
}

export async function reconcileOperation(
  tenantKey: string,
  userId: string,
  id: string,
  input: ReconcileGhlOperationInput,
  clientFactory: ClientFactory,
): Promise<GhlOperationSummary> {
  const record = await getRecord(tenantKey, id);
  if (record.status === 'reconciled') return { ...serialize(record), idempotent: true };
  if (!['provider_accepted', 'reconciliation_failed'].includes(record.status)) {
    throw new ConflictError(`GHL operation cannot be reconciled from ${record.status}`);
  }
  if (record.version !== input.expectedVersion) {
    throw new ConflictError(
      `Revision conflict: expected ${input.expectedVersion}, current ${record.version}`,
    );
  }
  if (record.operation_type === 'whatsapp_send') {
    throw new ConflictError('WhatsApp confirmation must arrive from the GHL message webhook');
  }
  const config = await resolveGhlSyncRuntimeConfig(tenantKey);
  if (!config.apiKey || !config.locationId) {
    throw new ValidationError('Tenant-owned GoHighLevel credentials are missing');
  }
  const client = clientFactory(config);
  const response = await readBack(client, record);
  if (!response.ok) {
    const failed = await transitionWithAudit(
      tenantKey,
      userId,
      record,
      'reconciliation_failed',
      {
        reconciliation_status: 'failed',
        failure_reason: `GHL read-back returned HTTP ${response.status}`,
      },
      'ghl_operation_reconciliation_failed',
      { method: 'read_back', providerStatus: response.status },
    );
    return serialize(failed);
  }
  const action = record.input_payload as unknown as GhlOperationAction;
  const comparison = compareReadBack(record, action, response.body);
  if (!comparison.matches) {
    const failed = await transitionWithAudit(
      tenantKey,
      userId,
      record,
      'reconciliation_failed',
      {
        reconciliation_status: 'failed',
        failure_reason: comparison.reasons.join('; '),
      },
      'ghl_operation_reconciliation_failed',
      { method: 'read_back', mismatch: comparison.reasons },
    );
    return serialize(failed);
  }
  const reconciled = await transitionWithAudit(
    tenantKey,
    userId,
    record,
    'reconciled',
    {
      reconciliation_status: 'confirmed',
      reconciled_at: new Date(),
      failure_reason: null,
    },
    'ghl_operation_reconciled',
    { method: 'read_back', providerStatus: response.status },
  );
  await prisma.$transaction(async (tx) => {
    await updateLeadAfterConfirmedOperation(
      tx,
      record,
      action,
      extractProviderIds(response.body, action.type),
    );
    await audit(tx, userId, 'ghl_operation_local_mirror_updated', record.id, 'success', {
      providerConfirmed: true,
    });
  });
  return serialize(reconciled);
}

export async function reconcileFromWebhook(input: {
  tenantKey: string;
  providerEventId: string;
  eventType: string;
  payloadHash: string;
  providerObjectId: string | null;
  operationTypes: GhlOperationAction['type'][];
  providerField:
    | 'provider_contact_id'
    | 'provider_opportunity_id'
    | 'provider_appointment_id'
    | 'provider_message_id'
    | null;
  locationId: string | null;
  summary: JsonRecord;
}): Promise<{ duplicate: boolean; operation: GhlOperationSummary | null }> {
  return prisma.$transaction(async (tx) => {
    const eventId = randomUUID();
    const inserted = await tx.ghlWebhookEvent.createMany({
      data: [
        {
          id: eventId,
          tenant_key: input.tenantKey,
          provider_event_id: input.providerEventId,
          event_type: input.eventType,
          payload_hash: input.payloadHash,
          signature_verified: true,
          processing_status: 'received',
          provider_object_id: input.providerObjectId,
          location_id: input.locationId,
          summary: input.summary as Prisma.InputJsonValue,
        },
      ],
      skipDuplicates: true,
    });
    if (inserted.count === 0) return { duplicate: true, operation: null };
    const providerFilter =
      input.providerField && input.providerObjectId
        ? { [input.providerField]: input.providerObjectId }
        : null;
    const command =
      providerFilter && input.operationTypes.length
        ? await tx.ghlOperationCommand.findFirst({
            where: {
              tenant_key: input.tenantKey,
              operation_type: { in: input.operationTypes },
              status: {
                in: ['executing', 'provider_accepted', 'reconciliation_failed', 'reconciled'],
              },
              ...providerFilter,
            },
            orderBy: { created_at: 'desc' },
          })
        : null;
    let operation: GhlOperationCommand | null = null;
    if (command) {
      const providerStatus = String(input.summary.providerStatus || '').toLowerCase();
      const messageConfirmed =
        command.operation_type === 'whatsapp_send' &&
        ['delivered', 'read'].includes(providerStatus);
      if (messageConfirmed && command.status !== 'reconciled') {
        operation = await tx.ghlOperationCommand.update({
          where: { id: command.id },
          data: {
            status: 'reconciled',
            reconciliation_status: 'confirmed',
            reconciled_at: new Date(),
            failure_reason: null,
            version: { increment: 1 },
          },
        });
        await audit(
          tx,
          command.requested_by_user_id,
          'ghl_operation_reconciled',
          command.id,
          'success',
          {
            method: 'webhook',
            eventType: input.eventType,
            providerEventId: input.providerEventId,
            providerStatus,
          },
        );
      } else {
        operation = command;
        await audit(
          tx,
          command.requested_by_user_id,
          'ghl_operation_webhook_confirmed',
          command.id,
          'success',
          {
            eventType: input.eventType,
            providerEventId: input.providerEventId,
            providerStatus,
            operationAlreadyReconciled: command.status === 'reconciled',
          },
        );
      }
    }
    await tx.ghlWebhookEvent.update({
      where: { id: eventId },
      data: {
        processing_status: command ? 'processed' : 'received',
        processed_at: command ? new Date() : null,
        error_summary: command ? null : 'No matching governed operation yet',
        summary: {
          ...input.summary,
          matchedOperationId: command?.id ?? null,
          processingOutcome: command
            ? operation?.status === 'reconciled'
              ? 'provider_confirmation_recorded'
              : 'matched_for_read_back'
            : 'no_matching_governed_operation',
        } as Prisma.InputJsonValue,
      },
    });
    return { duplicate: false, operation: operation ? serialize(operation) : null };
  });
}

async function reconcilePreviouslyReceivedMessageWebhook(
  record: GhlOperationCommand,
  userId: string,
): Promise<GhlOperationCommand> {
  if (record.operation_type !== 'whatsapp_send' || !record.provider_message_id) {
    return record;
  }
  const candidates = await prisma.ghlWebhookEvent.findMany({
    where: {
      tenant_key: record.tenant_key,
      provider_object_id: record.provider_message_id,
      processing_status: 'received',
    },
    orderBy: { received_at: 'desc' },
    take: 20,
  });
  const matched = candidates.find((candidate) => {
    const summary = asRecord(candidate.summary);
    const status = String(summary.providerStatus || '').toLowerCase();
    return (
      candidate.event_type.toLowerCase().includes('message') &&
      ['delivered', 'read'].includes(status)
    );
  });
  if (!matched) return record;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.ghlOperationCommand.updateMany({
      where: {
        id: record.id,
        tenant_key: record.tenant_key,
        status: 'provider_accepted',
        version: record.version,
      },
      data: {
        status: 'reconciled',
        reconciliation_status: 'confirmed',
        reconciled_at: new Date(),
        failure_reason: null,
        version: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      return tx.ghlOperationCommand.findUniqueOrThrow({ where: { id: record.id } });
    }
    await tx.ghlWebhookEvent.update({
      where: { id: matched.id },
      data: {
        processing_status: 'processed',
        processed_at: new Date(),
        error_summary: null,
      },
    });
    await audit(tx, userId, 'ghl_operation_reconciled', record.id, 'success', {
      method: 'stored_webhook',
      providerEventId: matched.provider_event_id,
      providerStatus: asRecord(matched.summary).providerStatus,
    });
    return tx.ghlOperationCommand.findUniqueOrThrow({ where: { id: record.id } });
  });
}

async function loadPreviewContext(
  tenantKey: string,
  userId: string,
  input: PrepareGhlOperationInput,
) {
  const lead = await prisma.leadCaptureRecord.findFirst({
    where: { id: input.action.leadId, tenant_key: tenantKey },
  });
  if (!lead) throw new NotFoundError('LeadCaptureRecord', input.action.leadId);
  if (input.eventId) {
    const event = await prisma.commercialEvent.findFirst({
      where: { id: input.eventId, tenant_key: tenantKey },
      select: { id: true },
    });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
    if (lead.event_id && lead.event_id !== input.eventId) {
      throw new ValidationError('The lead belongs to a different event');
    }
  }
  if (input.commercialPlanId) {
    const plan = await prisma.commercialPlan.findFirst({
      where: { id: input.commercialPlanId, tenant_key: tenantKey },
      select: { id: true },
    });
    if (!plan) throw new NotFoundError('CommercialPlan', input.commercialPlanId);
    if (lead.commercial_plan_id && lead.commercial_plan_id !== input.commercialPlanId) {
      throw new ValidationError('The lead belongs to a different commercial plan');
    }
  }
  if (input.stitchiActionRunId) {
    const run = await prisma.stitchiActionRun.findFirst({
      where: {
        id: input.stitchiActionRunId,
        tenant_key: tenantKey,
        user_id: userId,
      },
      select: { id: true },
    });
    if (!run) throw new NotFoundError('StitchiActionRun', input.stitchiActionRunId);
  }
  const eventId = input.eventId ?? lead.event_id;
  const [config, readiness, mapping] = await Promise.all([
    resolveGhlSyncRuntimeConfig(tenantKey),
    getGhlMappingReadiness(tenantKey),
    eventId ? getApprovedMappingForEvent(tenantKey, eventId) : Promise.resolve(null),
  ]);
  validateTenantMappings(input.action, readiness, mapping, lead);
  return { lead, config, mapping };
}

function validateTenantMappings(
  action: GhlOperationAction,
  readiness: Awaited<ReturnType<typeof getGhlMappingReadiness>>,
  mapping: Awaited<ReturnType<typeof getApprovedMappingForEvent>>,
  contextLead: LeadCaptureRecord,
): void {
  if (action.type === 'contact_tags_update') {
    const allowed = new Set(
      readiness.tags.items
        .filter((item) => item.status === 'mapped')
        .flatMap((item) => [item.ghlTagId, item.ghlTagName]),
    );
    const unknown = [...action.addTags, ...action.removeTags].filter(
      (value) => !allowed.has(value),
    );
    if (unknown.length) {
      throw new ValidationError(`These GHL tags are not tenant-approved: ${unknown.join(', ')}`);
    }
  }
  if (action.type === 'opportunity_upsert') {
    if (action.opportunityId && action.opportunityId !== contextLead.external_opportunity_id) {
      throw new ValidationError('The selected GHL opportunity is not linked to this customer');
    }
    const mapped = readiness.pipelines.items.some(
      (item) =>
        item.status === 'mapped' &&
        item.ghlPipelineId === action.pipelineId &&
        item.ghlStageId === action.stageId,
    );
    if (!mapped) {
      throw new ValidationError('The selected GHL pipeline and stage are not tenant-approved');
    }
    if (action.payment && !mapping) {
      throw new ValidationError(
        'Payment fields require an approved event-specific GHL attribution mapping',
      );
    }
    const allowedCustomFieldIds = new Set(
      mapping
        ? [
            mapping.sale_value_field,
            mapping.payment_amount_field,
            mapping.ticket_quantity_field,
            mapping.payment_status_field,
            mapping.payment_date_field,
          ].filter((value): value is string => Boolean(value))
        : [],
    );
    const unapprovedCustomFields = Object.keys(action.customFields).filter(
      (fieldId) => !allowedCustomFieldIds.has(fieldId),
    );
    if (unapprovedCustomFields.length) {
      throw new ValidationError(
        `These GHL opportunity fields are not approved for this event: ${unapprovedCustomFields.join(', ')}`,
      );
    }
  }
  if (
    action.type === 'appointment_upsert' &&
    action.appointmentId &&
    action.appointmentId !== contextLead.external_appointment_id
  ) {
    throw new ValidationError('The selected GHL appointment is not linked to this customer');
  }
}

function buildProviderPreview(
  config: GhlRuntimeConfig,
  lead: Awaited<ReturnType<typeof prisma.leadCaptureRecord.findFirst>> & {},
  mapping: Awaited<ReturnType<typeof getApprovedMappingForEvent>>,
  action: GhlOperationAction,
  providerReferences?: GhlOperationsReferenceData,
): JsonRecord {
  const blockers: string[] = [];
  if (!config.apiKey || !config.locationId || config.source !== 'tenant_vault') {
    blockers.push('Tenant-owned GoHighLevel credentials are missing');
  }
  const contactId = lead.external_source_id;
  const linkedToGhl = lead.external_source_provider === 'gohighlevel' && Boolean(contactId);
  if (
    action.type === 'contact_upsert' &&
    !lead.lead_email_placeholder &&
    !lead.lead_phone_placeholder
  ) {
    blockers.push('Add an email address or phone number before syncing this customer to GHL');
  }
  if (action.type !== 'contact_upsert' && !linkedToGhl) {
    blockers.push('Sync this customer to GHL before performing the selected action');
  }
  if (action.type === 'whatsapp_send' && String(lead.consent_status) !== 'granted') {
    blockers.push('Recorded customer consent is required before sending WhatsApp');
  }

  let providerEndpoint = '/contacts/upsert';
  let providerPayload: JsonRecord;
  let summary: JsonRecord;
  switch (action.type) {
    case 'contact_upsert': {
      providerPayload = {
        locationId: config.locationId || '<configured location>',
        name: lead.lead_name_placeholder || undefined,
        email: lead.lead_email_placeholder || undefined,
        phone: lead.lead_phone_placeholder || undefined,
        source: action.source || lead.lead_source || 'Tanaghum',
      };
      summary = {
        title: contactId ? 'Update customer in GHL' : 'Create customer in GHL',
        customer: lead.lead_name_placeholder || 'Unnamed customer',
        fields: ['name', 'email', 'phone', 'source'],
      };
      break;
    }
    case 'contact_tags_update': {
      providerEndpoint = `/contacts/${contactId || ':contactId'}/tags`;
      providerPayload = {
        contactId,
        addTags: action.addTags,
        removeTags: action.removeTags,
      };
      summary = {
        title: 'Update customer tags',
        add: action.addTags,
        remove: action.removeTags,
      };
      break;
    }
    case 'opportunity_upsert': {
      const opportunityId = action.opportunityId || lead.external_opportunity_id;
      const customFields = buildOpportunityCustomFields(
        action,
        mapping,
        providerReferences?.opportunityFields,
      );
      blockers.push(...customFields.blockers);
      providerEndpoint = opportunityId ? `/opportunities/${opportunityId}` : '/opportunities/';
      providerPayload = buildOpportunityProviderPayload(
        action,
        config.locationId || '<configured location>',
        contactId,
        opportunityId,
        customFields.fields,
      );
      summary = {
        title: opportunityId ? 'Update sale in GHL' : 'Create sale in GHL',
        opportunityName: action.name,
        status: action.status,
        monetaryValue: action.monetaryValue ?? null,
        payment: action.payment ?? null,
      };
      break;
    }
    case 'appointment_upsert': {
      providerEndpoint = action.appointmentId
        ? `/calendars/events/appointments/${action.appointmentId}`
        : '/calendars/events/appointments';
      providerPayload = {
        locationId: config.locationId || '<configured location>',
        contactId,
        calendarId: action.calendarId,
        title: action.title,
        startTime: action.startTime,
        endTime: action.endTime,
        appointmentStatus: action.status,
        notes: action.notes,
      };
      summary = {
        title: action.appointmentId ? 'Update meeting in GHL' : 'Book meeting in GHL',
        meeting: action.title,
        startTime: action.startTime,
        endTime: action.endTime,
        status: action.status,
      };
      break;
    }
    case 'whatsapp_send': {
      providerEndpoint = '/conversations/messages';
      providerPayload = {
        type: 'WhatsApp',
        contactId,
        message: action.message,
        status: 'pending',
        ...(action.templateId ? { templateId: action.templateId } : {}),
        ...(action.scheduledTimestamp ? { scheduledTimestamp: action.scheduledTimestamp } : {}),
      };
      summary = {
        title: 'Send WhatsApp through GHL',
        recipient: lead.lead_name_placeholder || 'Selected customer',
        message: action.message,
        scheduled: action.scheduledTimestamp ?? null,
      };
      break;
    }
  }
  return {
    operationType: action.type,
    provider: 'gohighlevel',
    providerEndpoint,
    resolvedOpportunityId:
      action.type === 'opportunity_upsert'
        ? action.opportunityId || lead.external_opportunity_id || null
        : null,
    providerPayload,
    summary,
    blockers,
    readyForApproval: blockers.length === 0,
    rawSecretsReturned: false,
  };
}

export function buildOpportunityProviderPayload(
  action: Extract<GhlOperationAction, { type: 'opportunity_upsert' }>,
  locationId: string,
  contactId: string | null,
  opportunityId: string | null | undefined,
  customFields: Array<{ id?: string; key?: string; fieldValue: string }>,
): JsonRecord {
  return {
    // GHL requires these identifiers when creating, but rejects them on update.
    ...(opportunityId ? {} : { locationId, contactId }),
    pipelineId: action.pipelineId,
    pipelineStageId: action.stageId,
    name: action.name,
    status: action.status,
    ...(action.monetaryValue !== undefined ? { monetaryValue: action.monetaryValue } : {}),
    customFields,
  };
}

export function buildOpportunityCustomFields(
  action: Extract<GhlOperationAction, { type: 'opportunity_upsert' }>,
  mapping: Awaited<ReturnType<typeof getApprovedMappingForEvent>>,
  opportunityFields?: GhlOpportunityFieldReference[],
): {
  fields: Array<{ id?: string; key?: string; fieldValue: string }>;
  blockers: string[];
} {
  const fields: Array<{ id?: string; key?: string; fieldValue: string }> = [];
  const blockers: string[] = [];
  const add = (identifier: string | null | undefined, value: unknown) => {
    if (!identifier || value === undefined || value === null || value === '') return;
    const definition = resolveOpportunityField(identifier, opportunityFields);
    if (opportunityFields && !definition) {
      blockers.push(`Mapped GHL opportunity field no longer exists: ${identifier}`);
      return;
    }
    const fieldValue = formatOpportunityFieldValue(value, definition);
    if (definition && fieldValue === null) {
      blockers.push(`Value '${String(value)}' is not valid for GHL field ${definition.name}`);
      return;
    }
    const reference = definition
      ? { id: definition.id }
      : identifier.includes('.')
        ? { key: identifier }
        : { id: identifier };
    fields.push({ ...reference, fieldValue: fieldValue ?? String(value) });
  };
  if (action.payment && mapping) {
    add(mapping.sale_value_field, action.payment.totalSaleValue);
    add(mapping.payment_amount_field, action.payment.amountPaid);
    add(mapping.ticket_quantity_field, action.payment.ticketQuantity);
    add(mapping.payment_status_field, action.payment.paymentStatus);
    add(mapping.payment_date_field, action.payment.paymentDate);
  }
  for (const [id, value] of Object.entries(action.customFields)) add(id, value);
  return { fields, blockers: [...new Set(blockers)] };
}

function resolveOpportunityField(
  identifier: string,
  definitions?: GhlOpportunityFieldReference[],
): GhlOpportunityFieldReference | null {
  if (!definitions) return null;
  const normalized = normalizeFieldReference(identifier);
  return (
    definitions.find(
      (definition) =>
        normalizeFieldReference(definition.id) === normalized ||
        normalizeFieldReference(definition.key || '') === normalized ||
        normalizeFieldReference(definition.name) === normalized,
    ) || null
  );
}

function formatOpportunityFieldValue(
  value: unknown,
  definition: GhlOpportunityFieldReference | null,
): string | null {
  if (!definition) return value instanceof Date ? value.toISOString() : String(value);
  if (definition.dataType === 'DATE') {
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  if (definition.dataType === 'SINGLE_OPTIONS') {
    const normalized = normalizeFieldReference(String(value));
    return (
      definition.picklistOptions.find((option) => normalizeFieldReference(option) === normalized) ||
      null
    );
  }
  return String(value);
}

function normalizeFieldReference(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

async function buildExecutionGate(
  record: GhlOperationCommand,
  config: GhlRuntimeConfig,
  client: GhlOperationsClient,
): Promise<string[]> {
  const reasons: string[] = [];
  if (!config.apiKey || !config.locationId || config.source !== 'tenant_vault') {
    reasons.push('Tenant-owned GoHighLevel credentials are missing');
  }
  if (process.env.GHL_WRITE_BACK_ENABLED !== 'true') {
    reasons.push('GHL_WRITE_BACK_ENABLED is not true');
  }
  const operationBlocker = operationRuntimeBlocker(record.operation_type);
  if (operationBlocker) reasons.push(operationBlocker);
  const rawAction = asRecord(record.input_payload);
  const rawPayment = asRecord(rawAction.payment);
  if (
    rawAction.type === 'opportunity_upsert' &&
    paidSaleRequiresWon({
      status: typeof rawAction.status === 'string' ? rawAction.status : undefined,
      payment: {
        paymentStatus:
          typeof rawPayment.paymentStatus === 'string' ? rawPayment.paymentStatus : undefined,
        amountPaid: typeof rawPayment.amountPaid === 'number' ? rawPayment.amountPaid : undefined,
      },
    })
  ) {
    reasons.push('A partial or fully paid sale must use Won opportunity status');
  }
  const parsedAction = ghlOperationActionSchema.safeParse(record.input_payload);
  if (!parsedAction.success) {
    reasons.push('Stored GHL operation payload is invalid');
  } else if (parsedAction.data.type === 'opportunity_upsert') {
    const providerPayload = asRecord(asRecord(record.preview_payload).providerPayload);
    if (providerPayload.status !== parsedAction.data.status) {
      reasons.push('Stored GHL opportunity preview no longer matches the approved action');
    }
  }
  if (
    !record.approval_id ||
    !record.capability_resolution_id ||
    !record.mcp_mediation_request_id ||
    !record.mcp_mediation_decision_id
  ) {
    reasons.push('Governance evidence is incomplete');
  } else {
    const [approval, resolution, mediation, mediationDecision] = await Promise.all([
      prisma.approval.findFirst({
        where: {
          id: record.approval_id,
          tenant_key: record.tenant_key,
          target_type: 'external_operation',
          target_id: record.id,
          approval_status: 'approved',
          OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
        },
        select: { id: true },
      }),
      prisma.capabilityResolution.findFirst({
        where: {
          id: record.capability_resolution_id,
          human_user_id: record.requested_by_user_id,
          resolution_status: 'resolved',
        },
        select: { id: true },
      }),
      prisma.mcpMediationRequest.findFirst({
        where: {
          id: record.mcp_mediation_request_id,
          approval_id: record.approval_id,
          capability_resolution_id: record.capability_resolution_id,
          request_status: 'approved',
        },
        select: { id: true },
      }),
      prisma.mcpMediationDecision.findFirst({
        where: {
          id: record.mcp_mediation_decision_id,
          mediation_request_id: record.mcp_mediation_request_id,
          decision: 'allow',
        },
        select: { id: true },
      }),
    ]);
    if (!approval) reasons.push('Approval is missing, expired or no longer approved');
    if (!resolution) reasons.push('Capability resolution is not currently valid');
    if (!mediation) reasons.push('MCP mediation request is not currently approved');
    if (!mediationDecision) reasons.push('MCP mediation decision is not currently allow');
  }
  const decision = evaluateExternalExecution({
    system: record.operation_type === 'whatsapp_send' ? 'whatsapp' : 'gohighlevel',
    action: record.operation_type === 'whatsapp_send' ? 'send_message' : 'write',
    executionMode: 'live',
    approvalId: record.approval_id,
    capabilityResolutionId: record.capability_resolution_id,
    mcpMediationRequestId: record.mcp_mediation_request_id,
    humanApproved: Boolean(record.approved_at && record.approved_by_user_id),
  });
  reasons.push(...decision.reasons);
  if (
    record.operation_type === 'whatsapp_send' &&
    config.apiKey &&
    config.locationId &&
    config.source === 'tenant_vault'
  ) {
    const contactId = requiredString(
      asRecord(asRecord(record.preview_payload).providerPayload).contactId,
      'GHL contact id',
    );
    try {
      const contact = await client.getContact(contactId);
      if (!contact.ok) {
        reasons.push(
          `GHL contact messaging eligibility could not be verified (HTTP ${contact.status})`,
        );
      } else if (isGhlWhatsAppDnd(contact.body)) {
        reasons.push('The customer is marked Do Not Disturb for WhatsApp in GHL');
      }
    } catch {
      reasons.push('GHL contact messaging eligibility could not be verified');
    }
  }
  return [...new Set(reasons)];
}

async function performProviderOperation(
  client: GhlOperationsClient,
  action: GhlOperationAction,
  preview: JsonRecord,
  payload: JsonRecord,
): Promise<GhlProviderResult> {
  switch (action.type) {
    case 'contact_upsert':
      return client.upsertContact(payload);
    case 'contact_tags_update': {
      const contactId = requiredString(payload.contactId, 'GHL contact id');
      const results: GhlProviderResult[] = [];
      if (action.addTags.length) results.push(await client.addTags(contactId, action.addTags));
      if (action.removeTags.length) {
        results.push(await client.removeTags(contactId, action.removeTags));
      }
      const failed = results.find((result) => !result.ok);
      return (
        failed || {
          ok: true,
          status: Math.max(...results.map((result) => result.status)),
          body: { contactId, tagsUpdated: true },
        }
      );
    }
    case 'opportunity_upsert': {
      const id =
        action.opportunityId ||
        (typeof preview.resolvedOpportunityId === 'string'
          ? preview.resolvedOpportunityId
          : undefined);
      return id ? client.updateOpportunity(id, payload) : client.createOpportunity(payload);
    }
    case 'appointment_upsert':
      return action.appointmentId
        ? client.updateAppointment(action.appointmentId, payload)
        : client.createAppointment(payload);
    case 'whatsapp_send':
      return client.sendWhatsApp(payload);
  }
}

async function readBack(
  client: GhlOperationsClient,
  record: GhlOperationCommand,
): Promise<GhlProviderResult> {
  if (
    record.operation_type === 'contact_upsert' ||
    record.operation_type === 'contact_tags_update'
  ) {
    return client.getContact(
      requiredString(record.provider_contact_id || record.provider_object_id, 'GHL contact id'),
    );
  }
  if (record.operation_type === 'opportunity_upsert') {
    return client.getOpportunity(
      requiredString(
        record.provider_opportunity_id || record.provider_object_id,
        'GHL opportunity id',
      ),
    );
  }
  if (record.operation_type === 'appointment_upsert') {
    return client.getAppointment(
      requiredString(
        record.provider_appointment_id || record.provider_object_id,
        'GHL appointment id',
      ),
    );
  }
  throw new ConflictError('This operation requires webhook reconciliation');
}

async function updateLeadAfterConfirmedOperation(
  tx: Prisma.TransactionClient,
  record: GhlOperationCommand,
  action: GhlOperationAction,
  ids: ReturnType<typeof extractProviderIds>,
): Promise<void> {
  if (!record.lead_id) return;
  const data: Prisma.LeadCaptureRecordUpdateManyMutationInput = {
    external_last_synced_at: new Date(),
    source_of_truth: 'gohighlevel',
    external_source_provider: 'gohighlevel',
  };
  if (ids.contactId) data.external_source_id = ids.contactId;
  if (action.type === 'contact_tags_update') {
    const lead = await tx.leadCaptureRecord.findFirst({
      where: { id: record.lead_id, tenant_key: record.tenant_key },
      select: { external_tags: true },
    });
    const tags = new Set(lead?.external_tags ?? []);
    action.addTags.forEach((tagValue) => tags.add(tagValue));
    action.removeTags.forEach((tagValue) => tags.delete(tagValue));
    data.external_tags = [...tags];
  }
  if (action.type === 'opportunity_upsert') {
    data.external_opportunity_id =
      ids.opportunityId ||
      action.opportunityId ||
      (typeof asRecord(record.preview_payload).resolvedOpportunityId === 'string'
        ? String(asRecord(record.preview_payload).resolvedOpportunityId)
        : undefined);
    data.external_pipeline_id = action.pipelineId;
    data.external_stage_id = action.stageId;
    if (action.payment) {
      data.sale_value = action.payment.totalSaleValue;
      data.amount_paid = action.payment.amountPaid;
      data.outstanding_balance = action.payment.outstandingBalance;
      data.payment_status = action.payment.paymentStatus;
      data.payment_date = action.payment.paymentDate
        ? new Date(action.payment.paymentDate)
        : undefined;
      data.ticket_quantity = action.payment.ticketQuantity;
      data.payment_source = 'gohighlevel_write';
    }
  }
  if (action.type === 'appointment_upsert') {
    data.external_appointment_id = ids.appointmentId || action.appointmentId || undefined;
    data.meeting_date = new Date(action.startTime);
    data.meeting_type = action.title;
    data.meeting_outcome = action.status;
  }
  await tx.leadCaptureRecord.updateMany({
    where: { id: record.lead_id, tenant_key: record.tenant_key },
    data,
  });
}

export function compareReadBack(
  record: Pick<GhlOperationCommand, 'preview_payload'>,
  action: GhlOperationAction,
  body: unknown,
): { matches: boolean; reasons: string[] } {
  const preview = asRecord(record.preview_payload);
  const expected = asRecord(preview.providerPayload);
  const root = asRecord(body);
  const actual =
    action.type === 'contact_upsert' || action.type === 'contact_tags_update'
      ? Object.keys(asRecord(root.contact)).length
        ? asRecord(root.contact)
        : root
      : action.type === 'opportunity_upsert'
        ? Object.keys(asRecord(root.opportunity)).length
          ? asRecord(root.opportunity)
          : root
        : Object.keys(asRecord(root.appointment || root.event)).length
          ? asRecord(root.appointment || root.event)
          : root;
  const reasons: string[] = [];
  const expectEqual = (label: string, expectedValue: unknown, actualValue: unknown) => {
    if (
      expectedValue !== undefined &&
      expectedValue !== null &&
      String(expectedValue) !== String(actualValue ?? '')
    ) {
      reasons.push(`${label} was not confirmed by GHL`);
    }
  };
  if (action.type === 'contact_upsert') {
    expectEqual('Customer email', expected.email, actual.email);
    expectEqual('Customer phone', expected.phone, actual.phone);
  } else if (action.type === 'contact_tags_update') {
    const actualTags = new Set(Array.isArray(actual.tags) ? actual.tags.map(String) : []);
    for (const tagValue of action.addTags) {
      if (!actualTags.has(tagValue)) reasons.push(`Added tag '${tagValue}' is missing in GHL`);
    }
    for (const tagValue of action.removeTags) {
      if (actualTags.has(tagValue))
        reasons.push(`Removed tag '${tagValue}' is still present in GHL`);
    }
  } else if (action.type === 'opportunity_upsert') {
    expectEqual('Pipeline', expected.pipelineId, actual.pipelineId);
    expectEqual('Pipeline stage', expected.pipelineStageId, actual.pipelineStageId);
    expectEqual('Opportunity status', expected.status, actual.status);
    expectEqual('Opportunity value', expected.monetaryValue, actual.monetaryValue);
    const actualFields = new Map(
      (Array.isArray(actual.customFields) ? actual.customFields : [])
        .map((value) => asRecord(value))
        .filter((value) => typeof value.id === 'string')
        .map((value) => [String(value.id), value.fieldValue]),
    );
    for (const field of Array.isArray(expected.customFields) ? expected.customFields : []) {
      const expectedField = asRecord(field);
      expectEqual(
        `Opportunity field ${String(expectedField.id)}`,
        expectedField.fieldValue,
        actualFields.get(String(expectedField.id)),
      );
    }
  } else if (action.type === 'appointment_upsert') {
    expectEqual('Calendar', expected.calendarId, actual.calendarId);
    expectEqual('Meeting status', expected.appointmentStatus, actual.appointmentStatus);
    expectEqual('Meeting start', expected.startTime, actual.startTime);
    expectEqual('Meeting end', expected.endTime, actual.endTime);
  }
  return { matches: reasons.length === 0, reasons };
}

async function getRecord(tenantKey: string, id: string): Promise<GhlOperationCommand> {
  const record = await prisma.ghlOperationCommand.findFirst({
    where: { id, tenant_key: tenantKey },
  });
  if (!record) throw new NotFoundError('GhlOperationCommand', id);
  return record;
}

async function transitionWithAudit(
  tenantKey: string,
  userId: string,
  record: GhlOperationCommand,
  target: GhlOperationStatus,
  data: Prisma.GhlOperationCommandUncheckedUpdateManyInput,
  action: string,
  state: JsonRecord,
): Promise<GhlOperationCommand> {
  assertGhlOperationTransition(record.status as GhlOperationStatus, target);
  return prisma.$transaction((tx) =>
    transitionWithAuditTx(tx, tenantKey, userId, record, target, data, action, state),
  );
}

async function transitionWithAuditTx(
  tx: Prisma.TransactionClient,
  tenantKey: string,
  userId: string,
  record: GhlOperationCommand,
  target: GhlOperationStatus,
  data: Prisma.GhlOperationCommandUncheckedUpdateManyInput,
  action: string,
  state: JsonRecord,
): Promise<GhlOperationCommand> {
  assertGhlOperationTransition(record.status as GhlOperationStatus, target);
  const result = await tx.ghlOperationCommand.updateMany({
    where: {
      id: record.id,
      tenant_key: tenantKey,
      status: record.status,
      version: record.version,
    },
    data: { ...data, status: target, version: { increment: 1 } },
  });
  if (result.count !== 1) throw new ConflictError('GHL operation changed concurrently');
  const auditResult =
    target === 'blocked'
      ? 'blocked'
      : ['rejected', 'failed', 'reconciliation_failed', 'expired', 'cancelled'].includes(target)
        ? 'failure'
        : 'success';
  await audit(tx, userId, action, record.id, auditResult, {
    from: record.status,
    to: target,
    ...state,
  });
  return tx.ghlOperationCommand.findUniqueOrThrow({ where: { id: record.id } });
}

function assertVersionAndHash(
  record: GhlOperationCommand,
  expectedVersion: number,
  previewHash: string,
): void {
  if (record.version !== expectedVersion) {
    throw new ConflictError(
      `Revision conflict: expected ${expectedVersion}, current ${record.version}`,
    );
  }
  assertHash(record, previewHash);
}

function assertHash(record: GhlOperationCommand, previewHash: string): void {
  if (record.preview_hash !== previewHash) {
    throw new ConflictError('GHL operation preview changed; review the latest preview');
  }
}

function assertNotExpired(record: GhlOperationCommand): void {
  if (record.expires_at <= new Date()) {
    throw new ConflictError('GHL operation preview expired; prepare a new operation');
  }
}

function serialize(record: GhlOperationCommand): GhlOperationSummary {
  return {
    id: record.id,
    tenantKey: record.tenant_key,
    eventId: record.event_id,
    commercialPlanId: record.commercial_plan_id,
    leadId: record.lead_id,
    stitchiActionRunId: record.stitchi_action_run_id,
    operationType: record.operation_type,
    status: record.status,
    reconciliationStatus: record.reconciliation_status,
    idempotencyKey: record.idempotency_key,
    previewHash: record.preview_hash,
    version: record.version,
    preview: publicPreview(record.preview_payload),
    providerObjectId: record.provider_object_id,
    providerContactId: record.provider_contact_id,
    providerOpportunityId: record.provider_opportunity_id,
    providerAppointmentId: record.provider_appointment_id,
    providerMessageId: record.provider_message_id,
    failureReason: record.failure_reason,
    requestedByUserId: record.requested_by_user_id,
    approvedByUserId: record.approved_by_user_id,
    approvedAt: record.approved_at,
    executedAt: record.executed_at,
    reconciledAt: record.reconciled_at,
    expiresAt: record.expires_at,
    attemptCount: record.attempt_count,
    rawSecretsReturned: false,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function publicPreview(value: unknown): JsonRecord {
  const preview = asRecord(value);
  return {
    operationType: preview.operationType,
    provider: preview.provider,
    providerEndpoint: preview.providerEndpoint,
    summary: asRecord(preview.summary),
    blockers: asStringArray(preview.blockers),
    readyForApproval: preview.readyForApproval === true,
    rawSecretsReturned: false,
  };
}

async function audit(
  tx: Prisma.TransactionClient,
  userId: string,
  action: string,
  objectId: string,
  result: 'success' | 'failure' | 'blocked' | 'denied',
  state: JsonRecord,
): Promise<void> {
  await tx.auditRecord.create({
    data: {
      audit_type: 'ghl_commercial_operation',
      action,
      result,
      human_user_id: userId,
      target_object_type: 'ghl_operation_command',
      target_object_id: objectId,
      source_substrate: 'STITCH',
      source_module: 'ghl-operations',
      reason: action,
      after_state: state as Prisma.InputJsonValue,
      risk_category: 'external_write',
      policy_matched: 'approved_tenant_scoped_exactly_once_ghl_operation',
    },
  });
}

function hashJson(value: unknown): string {
  return createHash('sha256').update(stableJson(value)).digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(',')}}`;
  }
  const encoded = JSON.stringify(value);
  return encoded === undefined ? 'null' : encoded;
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as JsonRecord) : {};
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ValidationError(`${label} is missing`);
  }
  return value.trim();
}
