import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import { Prisma } from '@prisma/client';
import type {
  CreateFieldMappingInput, UpdateFieldMappingInput, FieldMappingSummary,
  MappingValidationResult, FieldMappingEntry,
} from './types';
import { KPI_FIELD_NAMES, REQUIRED_KPI_FIELDS } from './types';

export function validateFieldMappings(mappings: FieldMappingEntry[]): MappingValidationResult {
  const errors: string[] = [];
  const missingRequired: string[] = [];
  const unknownTargetFields: string[] = [];

  const mappedTargets = new Set(mappings.map(m => m.targetField));

  for (const req of REQUIRED_KPI_FIELDS) {
    if (!mappedTargets.has(req)) {
      missingRequired.push(req);
    }
  }

  for (const mapping of mappings) {
    if (!KPI_FIELD_NAMES.includes(mapping.targetField as typeof KPI_FIELD_NAMES[number])) {
      unknownTargetFields.push(mapping.targetField);
    }
  }

  if (missingRequired.length > 0) {
    errors.push(`Missing required target fields: ${missingRequired.join(', ')}`);
  }
  if (unknownTargetFields.length > 0) {
    errors.push(`Unknown target fields: ${unknownTargetFields.join(', ')}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    missingRequired,
    unknownTargetFields,
  };
}

export async function listMappings(tenantKey: string, connectorId?: string): Promise<FieldMappingSummary[]> {
  const where: Prisma.ConnectorFieldMappingWhereInput = { tenant_key: tenantKey };
  if (connectorId) where.connector_id = connectorId;

  const mappings = await prisma.connectorFieldMapping.findMany({
    where,
    orderBy: { created_at: 'desc' },
  });
  return mappings.map(mapMapping);
}

export async function getMappingById(tenantKey: string, id: string): Promise<FieldMappingSummary> {
  const mapping = await prisma.connectorFieldMapping.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!mapping) throw new NotFoundError('ConnectorFieldMapping', id);
  return mapMapping(mapping);
}

export async function createMapping(
  tenantKey: string, userId: string, input: CreateFieldMappingInput,
): Promise<FieldMappingSummary> {
  if (input.eventId) {
    const event = await prisma.commercialEvent.findFirst({ where: { id: input.eventId, tenant_key: tenantKey } });
    if (!event) throw new NotFoundError('CommercialEvent', input.eventId);
  }

  const validation = validateFieldMappings(input.fieldMappings);

  const mapping = await prisma.connectorFieldMapping.create({
    data: {
      tenant_key: tenantKey,
      connector_id: input.connectorId,
      event_id: input.eventId,
      display_name: input.displayName,
      target_type: input.targetType ?? 'event_kpi_record',
      field_mappings: input.fieldMappings as unknown as Prisma.InputJsonValue,
      validation_status: validation.valid ? 'valid' : 'invalid',
      validation_errors: validation.valid ? Prisma.JsonNull : validation.errors as unknown as Prisma.InputJsonValue,
      created_by_user_id: userId,
    },
  });

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_mapping',
      action: 'mapping_created',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_field_mapping',
      target_object_id: mapping.id,
      reason: `Mapping created for ${input.connectorId}: ${input.displayName}`,
    },
  });

  return mapMapping(mapping);
}

export async function updateMapping(
  tenantKey: string, id: string, userId: string, input: UpdateFieldMappingInput,
): Promise<FieldMappingSummary> {
  const existing = await prisma.connectorFieldMapping.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('ConnectorFieldMapping', id);

  const data: Prisma.ConnectorFieldMappingUpdateInput = {};
  if (input.displayName !== undefined) data.display_name = input.displayName;
  if (input.targetType !== undefined) data.target_type = input.targetType;
  if (input.fieldMappings !== undefined) {
    const validation = validateFieldMappings(input.fieldMappings);
    data.field_mappings = input.fieldMappings as unknown as Prisma.InputJsonValue;
    data.validation_status = validation.valid ? 'valid' : 'invalid';
    data.validation_errors = validation.valid ? Prisma.JsonNull : validation.errors as unknown as Prisma.InputJsonValue;
  }

  const mapping = await prisma.connectorFieldMapping.update({ where: { id }, data });

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_mapping',
      action: 'mapping_updated',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_field_mapping',
      target_object_id: id,
      reason: 'Mapping updated',
    },
  });

  return mapMapping(mapping);
}

export async function deleteMapping(tenantKey: string, id: string, userId: string): Promise<void> {
  const existing = await prisma.connectorFieldMapping.findFirst({ where: { id, tenant_key: tenantKey } });
  if (!existing) throw new NotFoundError('ConnectorFieldMapping', id);

  await prisma.connectorFieldMapping.delete({ where: { id } });

  await prisma.auditRecord.create({
    data: {
      audit_type: 'connector_mapping',
      action: 'mapping_deleted',
      result: 'success',
      human_user_id: userId,
      target_object_type: 'connector_field_mapping',
      target_object_id: id,
      reason: 'Mapping deleted',
    },
  });
}

function mapMapping(m: Record<string, unknown>): FieldMappingSummary {
  return {
    id: m.id as string,
    tenantKey: m.tenant_key as string,
    connectorId: m.connector_id as string,
    eventId: m.event_id as string | null,
    displayName: m.display_name as string,
    targetType: m.target_type as FieldMappingSummary['targetType'],
    fieldMappings: m.field_mappings as FieldMappingSummary['fieldMappings'],
    validationStatus: m.validation_status as FieldMappingSummary['validationStatus'],
    validationErrors: m.validation_errors as string[] | null,
    createdByUserId: m.created_by_user_id as string,
    createdAt: m.created_at as Date,
    updatedAt: m.updated_at as Date,
  };
}
