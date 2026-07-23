import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { ConflictError, NotFoundError, ValidationError } from '@shared/errors';
import type {
  ApproveAttributionMappingInput,
  CreateAttributionMappingInput,
  ListAttributionMappingsInput,
  PreviewAttributionMatchInput,
  UpdateAttributionMappingInput,
} from './types';
import { evaluateGhlAttribution } from './matcher';

type Tx = Prisma.TransactionClient;

const include = {
  commercial_plan: { select: { id: true, title: true, linked_event_id: true, status: true } },
  event: { select: { id: true, name: true, event_date: true } },
  created_by: { select: { id: true, name: true, role: true } },
  approved_by: { select: { id: true, name: true, role: true } },
} satisfies Prisma.GhlPlanAttributionMappingInclude;

export async function listMappings(tenantKey: string, filters: ListAttributionMappingsInput) {
  const records = await prisma.ghlPlanAttributionMapping.findMany({
    where: {
      tenant_key: tenantKey,
      ...(filters.commercialPlanId ? { commercial_plan_id: filters.commercialPlanId } : {}),
      ...(filters.eventId ? { event_id: filters.eventId } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    },
    include,
    orderBy: [{ commercial_plan_id: 'asc' }, { mapping_version: 'desc' }],
  });
  return records.map(serialize);
}

export async function createMapping(
  tenantKey: string,
  userId: string,
  input: CreateAttributionMappingInput,
) {
  return prisma.$transaction(async (tx) => {
    await validatePlanEventLink(tx, tenantKey, input.commercialPlanId, input.eventId ?? null);
    const last = await tx.ghlPlanAttributionMapping.findFirst({
      where: { tenant_key: tenantKey, commercial_plan_id: input.commercialPlanId },
      select: { mapping_version: true },
      orderBy: { mapping_version: 'desc' },
    });
    const record = await tx.ghlPlanAttributionMapping.create({
      data: {
        tenant_key: tenantKey,
        commercial_plan_id: input.commercialPlanId,
        event_id: input.eventId ?? null,
        mapping_version: (last?.mapping_version ?? 0) + 1,
        location_id: input.locationId,
        pipeline_id: input.pipelineId ?? null,
        identifying_tags: input.identifyingTags,
        source_values: input.sourceValues,
        match_mode: input.matchMode,
        payment_amount_field: input.paymentAmountField ?? null,
        sale_value_field: input.saleValueField ?? null,
        ticket_quantity_field: input.ticketQuantityField ?? null,
        payment_status_field: input.paymentStatusField ?? null,
        custom_field_rules: input.customFieldRules as Prisma.InputJsonValue,
        effective_from: input.effectiveFrom ?? null,
        effective_to: input.effectiveTo ?? null,
        created_by_user_id: userId,
      },
      include,
    });
    await audit(tx, userId, 'ghl_plan_attribution_mapping_created', record.id, {
      commercialPlanId: input.commercialPlanId,
      eventId: input.eventId ?? null,
      version: record.mapping_version,
    });
    return serialize(record);
  });
}

export async function updateMapping(
  tenantKey: string,
  userId: string,
  id: string,
  input: UpdateAttributionMappingInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await getMapping(tx, tenantKey, id);
    if (existing.status !== 'draft') {
      throw new ConflictError('Only draft GHL attribution mappings can be edited');
    }
    assertRevision(existing.revision, input.expectedRevision);
    await validatePlanEventLink(
      tx,
      tenantKey,
      existing.commercial_plan_id,
      input.eventId === undefined ? existing.event_id : input.eventId,
    );
    assertEffectiveIdentityRules(existing, input);
    const updated = await tx.ghlPlanAttributionMapping.update({
      where: { id },
      data: {
        ...(input.eventId !== undefined ? { event_id: input.eventId } : {}),
        ...(input.locationId !== undefined ? { location_id: input.locationId } : {}),
        ...(input.pipelineId !== undefined ? { pipeline_id: input.pipelineId } : {}),
        ...(input.identifyingTags !== undefined
          ? { identifying_tags: input.identifyingTags }
          : {}),
        ...(input.sourceValues !== undefined ? { source_values: input.sourceValues } : {}),
        ...(input.matchMode !== undefined ? { match_mode: input.matchMode } : {}),
        ...(input.paymentAmountField !== undefined
          ? { payment_amount_field: input.paymentAmountField }
          : {}),
        ...(input.saleValueField !== undefined ? { sale_value_field: input.saleValueField } : {}),
        ...(input.ticketQuantityField !== undefined
          ? { ticket_quantity_field: input.ticketQuantityField }
          : {}),
        ...(input.paymentStatusField !== undefined
          ? { payment_status_field: input.paymentStatusField }
          : {}),
        ...(input.customFieldRules !== undefined
          ? { custom_field_rules: input.customFieldRules as Prisma.InputJsonValue }
          : {}),
        ...(input.effectiveFrom !== undefined ? { effective_from: input.effectiveFrom } : {}),
        ...(input.effectiveTo !== undefined ? { effective_to: input.effectiveTo } : {}),
        revision: { increment: 1 },
      },
      include,
    });
    await audit(tx, userId, 'ghl_plan_attribution_mapping_updated', id, {
      revision: updated.revision,
    });
    return serialize(updated);
  });
}

function assertEffectiveIdentityRules(
  existing: {
    pipeline_id: string | null;
    identifying_tags: string[];
    source_values: string[];
    custom_field_rules: Prisma.JsonValue;
    effective_from: Date | null;
    effective_to: Date | null;
  },
  input: UpdateAttributionMappingInput,
): void {
  const pipelineId = input.pipelineId === undefined ? existing.pipeline_id : input.pipelineId;
  const identifyingTags =
    input.identifyingTags === undefined ? existing.identifying_tags : input.identifyingTags;
  const sourceValues = input.sourceValues === undefined ? existing.source_values : input.sourceValues;
  const customFieldRules =
    input.customFieldRules === undefined
      ? parseRules(existing.custom_field_rules)
      : input.customFieldRules;
  if (!pipelineId && identifyingTags.length === 0 && sourceValues.length === 0 && customFieldRules.length === 0) {
    throw new ValidationError(
      'Define at least one pipeline, tag, source, or custom-field attribution rule',
    );
  }
  const effectiveFrom =
    input.effectiveFrom === undefined ? existing.effective_from : input.effectiveFrom;
  const effectiveTo = input.effectiveTo === undefined ? existing.effective_to : input.effectiveTo;
  if (effectiveFrom && effectiveTo && effectiveTo < effectiveFrom) {
    throw new ValidationError('Effective end must be on or after effective start');
  }
}

export async function approveMapping(
  tenantKey: string,
  userId: string,
  id: string,
  input: ApproveAttributionMappingInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await getMapping(tx, tenantKey, id);
    if (existing.status !== 'draft') {
      throw new ConflictError('Only a draft GHL attribution mapping can be approved');
    }
    assertRevision(existing.revision, input.expectedRevision);
    const now = new Date();
    await tx.ghlPlanAttributionMapping.updateMany({
      where: {
        tenant_key: tenantKey,
        commercial_plan_id: existing.commercial_plan_id,
        status: 'approved',
        id: { not: id },
      },
      data: { status: 'superseded', superseded_at: now, effective_to: now },
    });
    const approved = await tx.ghlPlanAttributionMapping.update({
      where: { id },
      data: {
        status: 'approved',
        approved_by_user_id: userId,
        approved_at: now,
        effective_from: existing.effective_from ?? now,
        revision: { increment: 1 },
      },
      include,
    });
    await audit(tx, userId, 'ghl_plan_attribution_mapping_approved', id, {
      commercialPlanId: existing.commercial_plan_id,
      eventId: existing.event_id,
      version: existing.mapping_version,
      reason: input.reason,
    });
    return serialize(approved);
  });
}

export async function previewMatch(
  tenantKey: string,
  id: string,
  candidate: PreviewAttributionMatchInput,
) {
  const mapping = await prisma.ghlPlanAttributionMapping.findFirst({
    where: { id, tenant_key: tenantKey },
  });
  if (!mapping) throw new NotFoundError('GhlPlanAttributionMapping', id);
  const evaluation = evaluateGhlAttribution(mapping, {
    pipelineIds: candidate.pipelineId ? [candidate.pipelineId] : [],
    tags: candidate.tags,
    source: candidate.source ?? null,
    customFields: candidate.customFields,
  });
  return {
    mappingId: mapping.id,
    commercialPlanId: mapping.commercial_plan_id,
    eventId: mapping.event_id,
    status: mapping.status,
    matchMode: mapping.match_mode,
    matched: evaluation.matched,
    checks: evaluation.checks,
    missingCustomFields: evaluation.missingCustomFields,
    writePerformed: false,
  };
}

export async function getApprovedMappingForEvent(tenantKey: string, eventId: string) {
  return prisma.ghlPlanAttributionMapping.findFirst({
    where: {
      tenant_key: tenantKey,
      status: 'approved',
      AND: [
        { OR: [{ effective_from: null }, { effective_from: { lte: new Date() } }] },
        { OR: [{ effective_to: null }, { effective_to: { gte: new Date() } }] },
        {
          OR: [
            { event_id: eventId },
            {
              commercial_plan: {
                is: {
                  tenant_key: tenantKey,
                  OR: [
                    { linked_event_id: eventId },
                    { event_links: { some: { event_id: eventId, status: 'active' } } },
                  ],
                },
              },
            },
          ],
        },
      ],
    },
    orderBy: [{ event_id: 'desc' }, { mapping_version: 'desc' }],
  });
}

async function validatePlanEventLink(
  tx: Tx,
  tenantKey: string,
  planId: string,
  eventId: string | null,
): Promise<void> {
  const plan = await tx.commercialPlan.findFirst({
    where: { id: planId, tenant_key: tenantKey },
    select: { id: true, linked_event_id: true },
  });
  if (!plan) throw new NotFoundError('CommercialPlan', planId);
  if (!eventId) return;
  const event = await tx.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    select: { id: true },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);
  if (plan.linked_event_id === eventId) return;
  const explicitLink = await tx.commercialPlanEventLink.findFirst({
    where: {
      tenant_key: tenantKey,
      commercial_plan_id: planId,
      event_id: eventId,
      status: 'active',
    },
    select: { id: true },
  });
  if (!explicitLink) {
    throw new ValidationError('The selected event must be linked to this commercial plan first');
  }
}

async function getMapping(tx: Tx, tenantKey: string, id: string) {
  const mapping = await tx.ghlPlanAttributionMapping.findFirst({
    where: { id, tenant_key: tenantKey },
  });
  if (!mapping) throw new NotFoundError('GhlPlanAttributionMapping', id);
  return mapping;
}

function assertRevision(actual: number, expected: number): void {
  if (actual !== expected) {
    throw new ConflictError(`Revision conflict: expected ${expected}, current ${actual}`);
  }
}

function parseRules(value: Prisma.JsonValue | null): Array<{
  field: string;
  operator: 'equals' | 'contains' | 'exists';
  value?: string | null;
}> {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (rule): rule is { field: string; operator: 'equals' | 'contains' | 'exists'; value?: string | null } =>
      typeof rule === 'object' &&
      rule !== null &&
      'field' in rule &&
      typeof rule.field === 'string' &&
      'operator' in rule &&
      ['equals', 'contains', 'exists'].includes(String(rule.operator)),
  );
}

function serialize(record: Record<string, unknown>) {
  return {
    id: record.id,
    commercialPlanId: record.commercial_plan_id,
    eventId: record.event_id,
    mappingVersion: record.mapping_version,
    status: record.status,
    locationId: record.location_id,
    pipelineId: record.pipeline_id,
    identifyingTags: record.identifying_tags,
    sourceValues: record.source_values,
    matchMode: record.match_mode,
    paymentAmountField: record.payment_amount_field,
    saleValueField: record.sale_value_field,
    ticketQuantityField: record.ticket_quantity_field,
    paymentStatusField: record.payment_status_field,
    customFieldRules: record.custom_field_rules,
    effectiveFrom: record.effective_from,
    effectiveTo: record.effective_to,
    commercialPlan: record.commercial_plan,
    event: record.event,
    createdBy: record.created_by,
    approvedBy: record.approved_by,
    approvedAt: record.approved_at,
    revision: record.revision,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

async function audit(
  tx: Tx,
  userId: string,
  action: string,
  objectId: string,
  state: Prisma.InputJsonValue,
): Promise<void> {
  await tx.auditRecord.create({
    data: {
      audit_type: 'ghl_plan_attribution',
      action,
      result: 'success',
      human_user_id: userId,
      target_object_type: 'ghl_plan_attribution_mapping',
      target_object_id: objectId,
      source_module: 'ghl-plan-attribution',
      reason: action,
      after_state: state,
    },
  });
}
