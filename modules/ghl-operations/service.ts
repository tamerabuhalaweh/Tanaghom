import type { SessionContext } from '@shared/auth';
import { ValidationError } from '@shared/errors';
import type { GhlRuntimeConfig } from '../ghl-sync/repository';
import { HighLevelOperationsClient, type GhlOperationsReferenceData } from './client';
import { checkGhlOperationPermission, hasGhlOperationPermission } from './policy';
import * as repo from './repository';
import { buildGhlExecutionReadiness } from './runtime';
import { sha256 } from './signature';
import type {
  DecideGhlOperationInput,
  ExecuteGhlOperationInput,
  ListGhlOperationsInput,
  PrepareGhlOperationInput,
  ReconcileGhlOperationInput,
  SubmitGhlOperationInput,
} from './types';

function clientFactory(config: GhlRuntimeConfig) {
  return new HighLevelOperationsClient({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    locationId: config.locationId,
    version: process.env.GHL_OPERATIONS_API_VERSION || 'v3',
  });
}

export async function list(session: SessionContext, filters: ListGhlOperationsInput) {
  checkGhlOperationPermission(session.role, 'ghl-operations:read');
  const rows = await repo.listOperations(session.tenantKey, filters);
  return rows.map((row) => visibleOperation(session, row));
}

export async function get(session: SessionContext, id: string) {
  checkGhlOperationPermission(session.role, 'ghl-operations:read');
  return visibleOperation(session, await repo.getOperation(session.tenantKey, id));
}

export async function referenceData(session: SessionContext) {
  checkGhlOperationPermission(session.role, 'ghl-operations:read');
  const canPrepare = hasGhlOperationPermission(session.role, 'ghl-operations:prepare');
  const { resolveGhlSyncRuntimeConfig } = await import('../ghl-sync/repository');
  const [config, webhookReadiness] = await Promise.all([
    resolveGhlSyncRuntimeConfig(session.tenantKey),
    repo.getWebhookReadiness(session.tenantKey),
  ]);
  const credentialsReady = Boolean(
    config.apiKey && config.locationId && config.source === 'tenant_vault',
  );
  const executionReadiness = buildGhlExecutionReadiness({
    credentialsReady,
    webhookLastVerifiedAt: webhookReadiness.lastVerifiedAt,
  });
  if (!canPrepare) {
    return {
      status: 'read_only',
      capabilities: capabilities(session.role),
      executionReadiness,
      tags: [],
      pipelines: [],
      calendars: [],
      opportunityFields: [],
      warnings: [],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    };
  }
  if (!config.apiKey || !config.locationId || config.source !== 'tenant_vault') {
    return {
      status: 'setup_required',
      capabilities: capabilities(session.role),
      executionReadiness,
      tags: [],
      pipelines: [],
      calendars: [],
      opportunityFields: [],
      warnings: ['Connect and validate the customer-owned GHL account first.'],
      rawSecretsReturned: false,
      rawPayloadReturned: false,
    };
  }
  const [result, readiness] = await Promise.all([
    clientFactory(config).referenceData(),
    import('../ghl-setup/repository').then((module) =>
      module.getGhlMappingReadiness(session.tenantKey),
    ),
  ]);
  const approvedTags = new Set(
    readiness.tags.items
      .filter((item) => item.status === 'mapped')
      .flatMap((item) => [item.ghlTagId, item.ghlTagName]),
  );
  const approvedStages = new Set(
    readiness.pipelines.items
      .filter((item) => item.status === 'mapped')
      .map((item) => `${item.ghlPipelineId}:${item.ghlStageId}`),
  );
  return {
    status: result.warnings.length ? 'partial' : 'ready',
    capabilities: capabilities(session.role),
    executionReadiness,
    ...result,
    tags: result.tags.map((tag) => ({
      ...tag,
      approved: approvedTags.has(tag.id) || approvedTags.has(tag.name),
    })),
    pipelines: result.pipelines.map((pipeline) => ({
      ...pipeline,
      stages: pipeline.stages.map((stage) => ({
        ...stage,
        approved: approvedStages.has(`${pipeline.id}:${stage.id}`),
      })),
      approved: pipeline.stages.some((stage) => approvedStages.has(`${pipeline.id}:${stage.id}`)),
    })),
    calendars: result.calendars.map((calendar) => ({ ...calendar, approved: true })),
    rawSecretsReturned: false,
    rawPayloadReturned: false,
  };
}

export async function prepare(session: SessionContext, input: PrepareGhlOperationInput) {
  checkGhlOperationPermission(session.role, 'ghl-operations:prepare');
  if (input.action.type === 'whatsapp_send') {
    checkGhlOperationPermission(session.role, 'ghl-operations:send-whatsapp');
  }
  const providerReferences = await validateLiveProviderReferences(session.tenantKey, input);
  return repo.prepareOperation(
    session.tenantKey,
    session.humanUserId,
    session.agentRepId,
    input,
    providerReferences,
  );
}

export async function submit(session: SessionContext, id: string, input: SubmitGhlOperationInput) {
  checkGhlOperationPermission(session.role, 'ghl-operations:prepare');
  return repo.submitOperation(
    session.tenantKey,
    session.humanUserId,
    session.agentRepId,
    id,
    input,
  );
}

export async function decide(session: SessionContext, id: string, input: DecideGhlOperationInput) {
  checkGhlOperationPermission(session.role, 'ghl-operations:approve');
  return repo.decideOperation(
    session.tenantKey,
    session.humanUserId,
    session.agentRepId,
    id,
    input,
  );
}

export async function execute(
  session: SessionContext,
  id: string,
  input: ExecuteGhlOperationInput,
) {
  checkGhlOperationPermission(session.role, 'ghl-operations:execute');
  if (process.env.GHL_BREAK_GLASS_EXECUTION_ENABLED !== 'true') {
    throw new ValidationError(
      'Manual CRM execution is disabled. Approved work is executed by the governed server worker.',
    );
  }
  return repo.executeOperation(session.tenantKey, session.humanUserId, id, input, clientFactory);
}

export async function processApprovedQueue(): Promise<{
  recovered: number;
  attempted: number;
  completed: number;
}> {
  const recovered = await repo.recoverStaleExecutions();
  const operations = await repo.listApprovedOperationIds();
  const results = await Promise.allSettled(
    operations.map(async (operation) => {
      const executed = await repo.executeOperation(
        operation.tenantKey,
        operation.requestedByUserId,
        operation.id,
        {
          previewHash: operation.previewHash,
          expectedVersion: operation.version,
        },
        clientFactory,
      );
      if (executed.status === 'provider_accepted' && executed.operationType !== 'whatsapp_send') {
        return repo.reconcileOperation(
          operation.tenantKey,
          operation.requestedByUserId,
          operation.id,
          { expectedVersion: executed.version },
          clientFactory,
        );
      }
      return executed;
    }),
  );
  return {
    recovered,
    attempted: operations.length,
    completed: results.filter((result) => result.status === 'fulfilled').length,
  };
}

export async function reconcile(
  session: SessionContext,
  id: string,
  input: ReconcileGhlOperationInput,
) {
  checkGhlOperationPermission(session.role, 'ghl-operations:execute');
  return repo.reconcileOperation(session.tenantKey, session.humanUserId, id, input, clientFactory);
}

export async function processWebhook(input: { tenantKey: string; rawBody: Buffer }) {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(input.rawBody.toString('utf8')) as Record<string, unknown>;
  } catch {
    throw new ValidationError('Invalid GoHighLevel webhook JSON');
  }
  const config = await resolveWebhookConfig(input.tenantKey);
  const locationId = firstString([
    body.locationId,
    body.location_id,
    asRecord(body.data).locationId,
    asRecord(body.contact).locationId,
    asRecord(body.opportunity).locationId,
  ]);
  if (!locationId || locationId !== config.locationId) {
    throw new ValidationError('Webhook location does not belong to this tenant');
  }
  const timestamp = firstString([
    body.timestamp,
    body.dateUpdated,
    asRecord(body.data).timestamp,
    asRecord(body.appointment).dateUpdated,
  ]);
  if (timestamp) {
    const receivedAt = new Date(timestamp);
    if (
      Number.isNaN(receivedAt.getTime()) ||
      Math.abs(Date.now() - receivedAt.getTime()) > 5 * 60 * 1000
    ) {
      throw new ValidationError('GoHighLevel webhook timestamp is invalid or stale');
    }
  } else if (process.env.GHL_WEBHOOK_REQUIRE_TIMESTAMP === 'true') {
    throw new ValidationError('GoHighLevel webhook timestamp is required');
  }
  const payloadHash = sha256(input.rawBody);
  const eventType =
    firstString([body.type, body.eventType, body.event, body.webhookType]) || 'unknown';
  const webhookTarget = classifyWebhook(eventType, body);
  const providerEventId =
    firstString([body.webhookId, body.deliveryId]) || sha256(`${eventType}:${payloadHash}`);
  return repo.reconcileFromWebhook({
    tenantKey: input.tenantKey,
    providerEventId,
    eventType,
    payloadHash,
    providerObjectId: webhookTarget.providerObjectId,
    operationTypes: webhookTarget.operationTypes,
    providerField: webhookTarget.providerField,
    locationId,
    summary: {
      eventType,
      providerObjectId: webhookTarget.providerObjectId,
      providerStatus: webhookTarget.providerStatus,
      locationMatched: true,
      timestampVerified: Boolean(timestamp),
      signatureVerified: true,
      rawPayloadStored: false,
    },
  });
}

function classifyWebhook(
  eventType: string,
  body: Record<string, unknown>,
): {
  operationTypes: Array<
    | 'contact_upsert'
    | 'contact_tags_update'
    | 'opportunity_upsert'
    | 'appointment_upsert'
    | 'whatsapp_send'
  >;
  providerField:
    | 'provider_contact_id'
    | 'provider_opportunity_id'
    | 'provider_appointment_id'
    | 'provider_message_id'
    | null;
  providerObjectId: string | null;
  providerStatus: string | null;
} {
  const lower = eventType.toLowerCase();
  const message = asRecord(body.message);
  const appointment = asRecord(body.appointment);
  const opportunity = asRecord(body.opportunity);
  const contact = asRecord(body.contact);
  if (lower.includes('message')) {
    return {
      operationTypes: ['whatsapp_send'],
      providerField: 'provider_message_id',
      providerObjectId: firstString([body.messageId, message.id, body.id]),
      providerStatus: firstString([body.status, message.status]),
    };
  }
  if (lower.includes('appointment')) {
    return {
      operationTypes: ['appointment_upsert'],
      providerField: 'provider_appointment_id',
      providerObjectId: firstString([body.appointmentId, appointment.id, body.id]),
      providerStatus: firstString([body.appointmentStatus, appointment.appointmentStatus]),
    };
  }
  if (lower.includes('opportunity')) {
    return {
      operationTypes: ['opportunity_upsert'],
      providerField: 'provider_opportunity_id',
      providerObjectId: firstString([body.opportunityId, opportunity.id, body.id]),
      providerStatus: firstString([body.status, opportunity.status]),
    };
  }
  if (lower.includes('contact')) {
    return {
      operationTypes: ['contact_upsert', 'contact_tags_update'],
      providerField: 'provider_contact_id',
      providerObjectId: firstString([body.contactId, contact.id, body.id]),
      providerStatus: firstString([body.status, contact.status]),
    };
  }
  return {
    operationTypes: [],
    providerField: null,
    providerObjectId: null,
    providerStatus: null,
  };
}

async function resolveWebhookConfig(tenantKey: string) {
  const { resolveGhlSyncRuntimeConfig } = await import('../ghl-sync/repository');
  const config = await resolveGhlSyncRuntimeConfig(tenantKey);
  if (!config.apiKey || !config.locationId || config.source !== 'tenant_vault') {
    throw new ValidationError('GoHighLevel is not configured for this tenant');
  }
  return config;
}

function capabilities(role: string) {
  return {
    read: hasGhlOperationPermission(role, 'ghl-operations:read'),
    prepare: hasGhlOperationPermission(role, 'ghl-operations:prepare'),
    approve: hasGhlOperationPermission(role, 'ghl-operations:approve'),
    execute: false,
    sendWhatsApp: hasGhlOperationPermission(role, 'ghl-operations:send-whatsapp'),
  };
}

function visibleOperation(
  session: SessionContext,
  operation: Awaited<ReturnType<typeof repo.getOperation>>,
) {
  const maySeeDetails =
    operation.requestedByUserId === session.humanUserId ||
    hasGhlOperationPermission(session.role, 'ghl-operations:approve');
  if (maySeeDetails) return operation;
  return {
    id: operation.id,
    eventId: operation.eventId,
    commercialPlanId: operation.commercialPlanId,
    leadId: operation.leadId,
    operationType: operation.operationType,
    status: operation.status,
    reconciliationStatus: operation.reconciliationStatus,
    failureReason: operation.failureReason ? 'This CRM action needs attention.' : null,
    createdAt: operation.createdAt,
    updatedAt: operation.updatedAt,
    preview: {
      operationType: operation.operationType,
      status: operation.status,
      summary: { title: 'Governed CRM operation' },
      detailsRestricted: true,
    },
  };
}

async function validateLiveProviderReferences(
  tenantKey: string,
  input: PrepareGhlOperationInput,
): Promise<GhlOperationsReferenceData | undefined> {
  const action = input.action;
  if (!['contact_tags_update', 'opportunity_upsert', 'appointment_upsert'].includes(action.type)) {
    return undefined;
  }
  const { resolveGhlSyncRuntimeConfig } = await import('../ghl-sync/repository');
  const config = await resolveGhlSyncRuntimeConfig(tenantKey);
  if (!config.apiKey || !config.locationId || config.source !== 'tenant_vault') return undefined;
  const refs = await clientFactory(config).referenceData();
  if (action.type === 'contact_tags_update') {
    const available = new Set(refs.tags.flatMap((tag) => [tag.id, tag.name]));
    const missing = [...action.addTags, ...action.removeTags].filter((tag) => !available.has(tag));
    if (missing.length) {
      throw new ValidationError(`These GHL tags no longer exist: ${missing.join(', ')}`);
    }
  }
  if (action.type === 'opportunity_upsert') {
    const pipeline = refs.pipelines.find((row) => row.id === action.pipelineId);
    if (!pipeline) throw new ValidationError('The selected GHL pipeline no longer exists');
    if (!pipeline.stages.some((stage) => stage.id === action.stageId)) {
      throw new ValidationError('The selected GHL stage does not belong to this pipeline');
    }
  }
  if (
    action.type === 'appointment_upsert' &&
    !refs.calendars.some((calendar) => calendar.id === action.calendarId)
  ) {
    throw new ValidationError('The selected GHL calendar no longer exists');
  }
  return refs;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function firstString(values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}
