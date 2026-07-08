import { Prisma } from '@prisma/client';
import { prisma } from '@shared/database';
import { getActiveIntegrationCredential } from '../integration-credentials/service';
import { LEAD_STATUSES, LEAD_TEMPERATURES } from '../lead-lifecycle/types';
import type {
  CredentialStatus,
  GhlCredentialStatus,
  GhlMappingReadiness,
  GhlTagMapping,
  GhlPipelineMapping,
  GhlLocationMapping,
  MappingReadinessState,
  GhlTagTarget,
} from './types';

export interface GhlSetupRuntimeConfig {
  baseUrl: string;
  apiKey: string;
  locationId: string;
  source: 'tenant_vault' | 'missing';
}

export async function resolveGhlSetupRuntimeConfig(tenantKey: string): Promise<GhlSetupRuntimeConfig> {
  const credential = await getActiveIntegrationCredential('gohighlevel', 'api_key', tenantKey);
  if (!credential) {
    return {
      baseUrl: process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com',
      apiKey: '',
      locationId: '',
      source: 'missing',
    };
  }

  return {
    baseUrl: String(credential.secrets.baseUrl || process.env.GHL_BASE_URL || 'https://services.leadconnectorhq.com'),
    apiKey: String(credential.secrets.apiKey || ''),
    locationId: String(credential.secrets.locationId || ''),
    source: 'tenant_vault',
  };
}

export async function getGhlCredentialStatus(tenantKey: string): Promise<GhlCredentialStatus> {
  const credential = await prisma.integrationCredential.findUnique({
    where: {
      tenant_key_provider_credential_type_connection_key: {
        tenant_key: tenantKey,
        provider: 'gohighlevel',
        credential_type: 'api_key',
        connection_key: 'default',
      },
    },
    select: {
      id: true,
      encrypted_payload: true,
      secret_fingerprints: true,
      last_validated_at: true,
      is_active: true,
    },
  });

  if (!credential || !credential.is_active) {
    return {
      provider: 'gohighlevel',
      credentialType: 'api_key',
      status: 'missing',
      hasApiKey: false,
      hasLocationId: false,
      secretFields: [],
      lastValidatedAt: null,
      rawSecretsReturned: false,
    };
  }

  const fingerprints = credential.secret_fingerprints as Record<string, string> | null;
  const secretFields = fingerprints ? Object.keys(fingerprints) : [];
  const hasApiKey = secretFields.includes('apiKey');
  const hasLocationId = secretFields.includes('locationId');

  let status: CredentialStatus = 'configured';
  if (credential.last_validated_at) {
    status = 'validated';
  }

  return {
    provider: 'gohighlevel',
    credentialType: 'api_key',
    status,
    hasApiKey,
    hasLocationId,
    secretFields,
    lastValidatedAt: credential.last_validated_at?.toISOString() ?? null,
    rawSecretsReturned: false,
  };
}

export async function getGhlMappingReadiness(tenantKey: string): Promise<GhlMappingReadiness> {
  const tagMappings = await prisma.connectorFieldMapping.findMany({
    where: {
      tenant_key: tenantKey,
      connector_id: 'gohighlevel',
    },
    select: {
      id: true,
      field_mappings: true,
      validation_status: true,
    },
  });

  const tags: GhlTagMapping[] = [];
  const pipelines: GhlPipelineMapping[] = [];

  for (const mapping of tagMappings) {
    const fields = mapping.field_mappings as Record<string, unknown> | null;
    if (!fields || typeof fields !== 'object') continue;

    if (fields.mappingType === 'tag' || (!fields.mappingType && fields.ghlTagName)) {
      tags.push({
        ghlTagId: String(fields.ghlTagId || ''),
        ghlTagName: String(fields.ghlTagName || ''),
        internalTag: normalizeTagTarget(fields.internalTag),
        direction: (fields.direction as GhlTagMapping['direction']) || 'bidirectional',
        status: mapping.validation_status === 'valid' ? 'mapped' : 'pending',
      });
    }

    if (fields.mappingType === 'pipeline' || (!fields.mappingType && fields.ghlPipelineId)) {
      pipelines.push({
        ghlPipelineId: String(fields.ghlPipelineId || ''),
        ghlPipelineName: String(fields.ghlPipelineName || ''),
        ghlStageId: String(fields.ghlStageId || ''),
        ghlStageName: String(fields.ghlStageName || ''),
        internalStage: String(fields.internalStage || ''),
        status: mapping.validation_status === 'valid' ? 'mapped' : 'pending',
      });
    }
  }

  const locationMapping = await prisma.connectorFieldMapping.findFirst({
    where: {
      tenant_key: tenantKey,
      connector_id: 'gohighlevel_location',
    },
    select: {
      field_mappings: true,
      validation_status: true,
    },
  });

  let location: GhlMappingReadiness['location']['mapping'] = null;
  if (locationMapping) {
    const fields = locationMapping.field_mappings as Record<string, unknown> | null;
    if (fields && typeof fields === 'object') {
      location = {
        ghlLocationId: String(fields.ghlLocationId || ''),
        displayName: String(fields.displayName || 'GHL Location'),
        status: locationMapping.validation_status === 'valid' ? 'mapped' : 'pending',
      };
    }
  }

  const tagsMappedCount = tags.filter(t => t.status === 'mapped').length;
  const pipelinesMappedCount = pipelines.filter(p => p.status === 'mapped').length;

  const resolveState = (mapped: number, total: number): MappingReadinessState => {
    if (total === 0) return 'not_started';
    if (mapped === total) return 'ready';
    if (mapped > 0) return 'partial';
    return 'not_started';
  };

  return {
    tags: {
      state: resolveState(tagsMappedCount, tags.length),
      mappedCount: tagsMappedCount,
      totalCount: tags.length,
      items: tags,
    },
    pipelines: {
      state: resolveState(pipelinesMappedCount, pipelines.length),
      mappedCount: pipelinesMappedCount,
      totalCount: pipelines.length,
      items: pipelines,
    },
    location: {
      state: location ? (location.status === 'mapped' ? 'ready' : 'partial') : 'not_started',
      mapping: location,
    },
  };
}

export async function saveTagMapping(
  tenantKey: string,
  userId: string,
  mapping: Omit<GhlTagMapping, 'status'>,
): Promise<void> {
  const validation = validateGhlTagMapping(mapping);
  await prisma.connectorFieldMapping.create({
    data: {
      tenant_key: tenantKey,
      connector_id: 'gohighlevel',
      display_name: `GHL Tag: ${mapping.ghlTagName} -> ${mapping.internalTag}`,
      field_mappings: {
        mappingType: 'tag',
        ghlTagId: mapping.ghlTagId,
        ghlTagName: mapping.ghlTagName,
        internalTag: mapping.internalTag,
        direction: mapping.direction,
      },
      validation_status: validation.valid ? 'valid' : 'invalid',
      validation_errors: validation.valid ? Prisma.JsonNull : validation.errors as unknown as Prisma.InputJsonValue,
      created_by_user_id: userId,
    },
  });
}

export async function savePipelineMapping(
  tenantKey: string,
  userId: string,
  mapping: Omit<GhlPipelineMapping, 'status'>,
): Promise<void> {
  const validation = validateGhlPipelineMapping(mapping);
  await prisma.connectorFieldMapping.create({
    data: {
      tenant_key: tenantKey,
      connector_id: 'gohighlevel',
      display_name: `GHL Pipeline: ${mapping.ghlPipelineName}/${mapping.ghlStageName} -> ${mapping.internalStage}`,
      field_mappings: {
        mappingType: 'pipeline',
        ghlPipelineId: mapping.ghlPipelineId,
        ghlPipelineName: mapping.ghlPipelineName,
        ghlStageId: mapping.ghlStageId,
        ghlStageName: mapping.ghlStageName,
        internalStage: mapping.internalStage,
      },
      validation_status: validation.valid ? 'valid' : 'invalid',
      validation_errors: validation.valid ? Prisma.JsonNull : validation.errors as unknown as Prisma.InputJsonValue,
      created_by_user_id: userId,
    },
  });
}

export async function saveLocationMapping(
  tenantKey: string,
  userId: string,
  mapping: Omit<GhlLocationMapping, 'status'>,
): Promise<void> {
  const validation = validateLocationMapping(mapping);
  await prisma.connectorFieldMapping.create({
    data: {
      tenant_key: tenantKey,
      connector_id: 'gohighlevel_location',
      display_name: `GHL Location: ${mapping.displayName}`,
      field_mappings: {
        ghlLocationId: mapping.ghlLocationId,
        displayName: mapping.displayName,
      },
      validation_status: validation.valid ? 'valid' : 'invalid',
      validation_errors: validation.valid ? Prisma.JsonNull : validation.errors as unknown as Prisma.InputJsonValue,
      created_by_user_id: userId,
    },
  });
}

export async function markGhlCredentialValidated(tenantKey: string, validatedAt = new Date()): Promise<void> {
  await prisma.integrationCredential.update({
    where: {
      tenant_key_provider_credential_type_connection_key: {
        tenant_key: tenantKey,
        provider: 'gohighlevel',
        credential_type: 'api_key',
        connection_key: 'default',
      },
    },
    data: {
      last_validated_at: validatedAt,
    },
  });
}

function normalizeTagTarget(value: unknown): GhlTagTarget {
  const target = String(value || 'new_lead');
  if (isLeadStatusOrTemperature(target)) return target;
  return 'new_lead';
}

function isLeadStatusOrTemperature(value: string): value is GhlTagTarget {
  return (LEAD_STATUSES as readonly string[]).includes(value) || (LEAD_TEMPERATURES as readonly string[]).includes(value);
}

function validateGhlTagMapping(mapping: Omit<GhlTagMapping, 'status'>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!mapping.ghlTagId.trim()) errors.push('GHL tag id is required');
  if (!mapping.ghlTagName.trim()) errors.push('GHL tag name is required');
  if (!isLeadStatusOrTemperature(mapping.internalTag)) {
    errors.push(`Unsupported Tanaghum lead tag target: ${mapping.internalTag}`);
  }
  return { valid: errors.length === 0, errors };
}

function validateGhlPipelineMapping(mapping: Omit<GhlPipelineMapping, 'status'>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!mapping.ghlPipelineId.trim()) errors.push('GHL pipeline id is required');
  if (!mapping.ghlPipelineName.trim()) errors.push('GHL pipeline name is required');
  if (!mapping.ghlStageId.trim()) errors.push('GHL stage id is required');
  if (!mapping.ghlStageName.trim()) errors.push('GHL stage name is required');
  if (!(LEAD_STATUSES as readonly string[]).includes(mapping.internalStage)) {
    errors.push(`Unsupported Tanaghum sales stage target: ${mapping.internalStage}`);
  }
  return { valid: errors.length === 0, errors };
}

function validateLocationMapping(mapping: Omit<GhlLocationMapping, 'status'>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!mapping.ghlLocationId.trim()) errors.push('GHL location id is required');
  if (!mapping.displayName.trim()) errors.push('GHL location display name is required');
  return { valid: errors.length === 0, errors };
}
