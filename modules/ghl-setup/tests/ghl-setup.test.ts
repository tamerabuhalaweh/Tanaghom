import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  integrationCredential: {
    findUnique: vi.fn(),
  },
  connectorFieldMapping: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));

import * as repo from '../repository';
import { getWizardState, attemptLiveWrite, saveTagMappings, savePipelineMappings, saveLocationMapping } from '../service';

describe('GHL Setup — tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.integrationCredential.findUnique.mockResolvedValue(null);
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
  });

  it('wizard state scopes credential lookup to tenant key', async () => {
    await getWizardState('admin', 'customer-x');
    expect(prismaMocks.integrationCredential.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenant_key_provider_credential_type_connection_key: expect.objectContaining({
            tenant_key: 'customer-x',
          }),
        }),
      }),
    );
  });

  it('wizard state scopes mapping lookup to tenant key', async () => {
    await getWizardState('admin', 'customer-y');
    expect(prismaMocks.connectorFieldMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenant_key: 'customer-y' }),
      }),
    );
  });

  it('different tenants get independent wizard states', async () => {
    prismaMocks.integrationCredential.findUnique.mockResolvedValueOnce({
      id: 'cred-1',
      encrypted_payload: { apiKey: 'enc-1', locationId: 'enc-2' },
      secret_fingerprints: { apiKey: 'fp-1', locationId: 'fp-2' },
      last_validated_at: new Date(),
      is_active: true,
    });
    prismaMocks.integrationCredential.findUnique.mockResolvedValueOnce(null);

    const stateA = await getWizardState('admin', 'customer-a');
    const stateB = await getWizardState('admin', 'customer-b');

    expect(stateA.credentialStatus.status).toBe('validated');
    expect(stateB.credentialStatus.status).toBe('missing');
  });

  it('tag mapping save scopes to tenant key', async () => {
    prismaMocks.connectorFieldMapping.create.mockResolvedValue({});
    await saveTagMappings('admin', 'user-1', 'customer-z', [
      { ghlTagId: 'tag-1', ghlTagName: 'Lead', internalTag: 'new_lead', direction: 'inbound' },
    ]);
    expect(prismaMocks.connectorFieldMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant_key: 'customer-z' }),
      }),
    );
  });

  it('pipeline mapping save scopes to tenant key', async () => {
    prismaMocks.connectorFieldMapping.create.mockResolvedValue({});
    await savePipelineMappings('admin', 'user-1', 'customer-w', [
      { ghlPipelineId: 'pipe-1', ghlPipelineName: 'Sales', ghlStageId: 'stage-1', ghlStageName: 'New', internalStage: 'qualified' },
    ]);
    expect(prismaMocks.connectorFieldMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant_key: 'customer-w' }),
      }),
    );
  });

  it('location mapping save scopes to tenant key', async () => {
    prismaMocks.connectorFieldMapping.create.mockResolvedValue({});
    await saveLocationMapping('admin', 'user-1', 'customer-v', {
      ghlLocationId: 'loc-1',
      displayName: 'Main Office',
    });
    expect(prismaMocks.connectorFieldMapping.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tenant_key: 'customer-v' }),
      }),
    );
  });
});

describe('GHL Setup — no secret exposure', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
  });

  it('wizard state never returns raw secret values', async () => {
    prismaMocks.integrationCredential.findUnique.mockResolvedValue({
      id: 'cred-1',
      encrypted_payload: { apiKey: 'encrypted-api-key-value', locationId: 'encrypted-location-value' },
      secret_fingerprints: { apiKey: 'fp-abc123', locationId: 'fp-def456' },
      last_validated_at: new Date(),
      is_active: true,
    });

    const state = await getWizardState('admin', 'customer-a');
    const json = JSON.stringify(state);

    expect(json).not.toContain('encrypted-api-key-value');
    expect(json).not.toContain('encrypted-location-value');
    expect(state.credentialStatus.rawSecretsReturned).toBe(false);
  });

  it('credential status endpoint returns rawSecretsReturned: false', async () => {
    prismaMocks.integrationCredential.findUnique.mockResolvedValue({
      id: 'cred-1',
      encrypted_payload: { apiKey: 'secret-key' },
      secret_fingerprints: { apiKey: 'fp-1' },
      last_validated_at: null,
      is_active: true,
    });

    const state = await getWizardState('admin', 'customer-a');
    expect(state.credentialStatus.rawSecretsReturned).toBe(false);
    expect(state.credentialStatus.secretFields).toEqual(['apiKey']);
  });

  it('missing credential returns empty secret fields', async () => {
    prismaMocks.integrationCredential.findUnique.mockResolvedValue(null);

    const state = await getWizardState('admin', 'customer-a');
    expect(state.credentialStatus.secretFields).toEqual([]);
    expect(state.credentialStatus.hasApiKey).toBe(false);
    expect(state.credentialStatus.hasLocationId).toBe(false);
  });
});

describe('GHL Setup — mapping validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.integrationCredential.findUnique.mockResolvedValue({
      id: 'cred-1',
      encrypted_payload: { apiKey: 'enc-1', locationId: 'enc-2' },
      secret_fingerprints: { apiKey: 'fp-1', locationId: 'fp-2' },
      last_validated_at: new Date(),
      is_active: true,
    });
  });

  it('tag mappings are counted correctly', async () => {
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([
      {
        id: 'm1',
        field_mappings: { mappingType: 'tag', ghlTagId: 't1', ghlTagName: 'Lead', internalTag: 'new_lead', direction: 'inbound' },
        validation_status: 'valid',
      },
      {
        id: 'm2',
        field_mappings: { mappingType: 'tag', ghlTagId: 't2', ghlTagName: 'Customer', internalTag: 'customer', direction: 'bidirectional' },
        validation_status: 'untested',
      },
    ]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);

    const readiness = await repo.getGhlMappingReadiness('customer-a');

    expect(readiness.tags.totalCount).toBe(2);
    expect(readiness.tags.mappedCount).toBe(1);
    expect(readiness.tags.state).toBe('partial');
  });

  it('pipeline mappings are counted correctly', async () => {
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([
      {
        id: 'm1',
        field_mappings: { mappingType: 'pipeline', ghlPipelineId: 'p1', ghlPipelineName: 'Sales', ghlStageId: 's1', ghlStageName: 'New', internalStage: 'qualified' },
        validation_status: 'valid',
      },
    ]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);

    const readiness = await repo.getGhlMappingReadiness('customer-a');

    expect(readiness.pipelines.totalCount).toBe(1);
    expect(readiness.pipelines.mappedCount).toBe(1);
    expect(readiness.pipelines.state).toBe('ready');
  });

  it('no mappings returns not_started state', async () => {
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);

    const readiness = await repo.getGhlMappingReadiness('customer-a');

    expect(readiness.tags.state).toBe('not_started');
    expect(readiness.pipelines.state).toBe('not_started');
    expect(readiness.location.state).toBe('not_started');
    expect(readiness.location.mapping).toBeNull();
  });

  it('wizard state computes current step from credential and mapping state', async () => {
    prismaMocks.integrationCredential.findUnique.mockResolvedValue(null);
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);

    const state = await getWizardState('admin', 'customer-a');
    expect(state.currentStep).toBe('credentials');
    expect(state.completedSteps).not.toContain('credentials');
  });

  it('wizard state advances to tags step when credentials are complete', async () => {
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue({
      field_mappings: { ghlLocationId: 'loc-1', displayName: 'Main' },
      validation_status: 'valid',
    });

    const state = await getWizardState('admin', 'customer-a');
    expect(state.currentStep).toBe('tags');
    expect(state.completedSteps).toContain('credentials');
    expect(state.completedSteps).toContain('location');
  });
});

describe('GHL Setup — blocked write path', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.integrationCredential.findUnique.mockResolvedValue(null);
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
  });

  it('live write is always blocked', async () => {
    const result = await attemptLiveWrite('admin', 'customer-a');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('not authorized');
  });

  it('wizard state always reports liveWriteBlocked: true', async () => {
    const state = await getWizardState('admin', 'customer-a');
    expect(state.liveWriteBlocked).toBe(true);
    expect(state.blockReason).toBeTruthy();
  });

  it('tag mapping save returns liveWriteBlocked: true', async () => {
    prismaMocks.connectorFieldMapping.create.mockResolvedValue({});
    const result = await saveTagMappings('admin', 'user-1', 'customer-a', [
      { ghlTagId: 'tag-1', ghlTagName: 'Lead', internalTag: 'new_lead', direction: 'inbound' },
    ]);
    expect(result.liveWriteBlocked).toBe(true);
  });

  it('pipeline mapping save returns liveWriteBlocked: true', async () => {
    prismaMocks.connectorFieldMapping.create.mockResolvedValue({});
    const result = await savePipelineMappings('admin', 'user-1', 'customer-a', [
      { ghlPipelineId: 'p1', ghlPipelineName: 'Sales', ghlStageId: 's1', ghlStageName: 'New', internalStage: 'qualified' },
    ]);
    expect(result.liveWriteBlocked).toBe(true);
  });

  it('location mapping save returns liveWriteBlocked: true', async () => {
    prismaMocks.connectorFieldMapping.create.mockResolvedValue({});
    const result = await saveLocationMapping('admin', 'user-1', 'customer-a', {
      ghlLocationId: 'loc-1',
      displayName: 'Main',
    });
    expect(result.liveWriteBlocked).toBe(true);
  });

  it('write endpoint blocks non-admin roles too', async () => {
    const result = await attemptLiveWrite('viewer', 'customer-a');
    expect(result.allowed).toBe(false);
  });
});

describe('GHL Setup — RBAC', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.integrationCredential.findUnique.mockResolvedValue(null);
    prismaMocks.connectorFieldMapping.findMany.mockResolvedValue([]);
    prismaMocks.connectorFieldMapping.findFirst.mockResolvedValue(null);
  });

  it('admin can read wizard state', async () => {
    await expect(getWizardState('admin', 'customer-a')).resolves.toBeDefined();
  });

  it('viewer can read wizard state', async () => {
    await expect(getWizardState('viewer', 'customer-a')).resolves.toBeDefined();
  });

  it('unknown role cannot read wizard state', async () => {
    await expect(getWizardState('unknown', 'customer-a')).rejects.toThrow(/does not have permission/);
  });

  it('viewer cannot save tag mappings', async () => {
    await expect(
      saveTagMappings('viewer', 'user-1', 'customer-a', [
        { ghlTagId: 't1', ghlTagName: 'Lead', internalTag: 'new_lead', direction: 'inbound' },
      ]),
    ).rejects.toThrow(/does not have permission/);
  });

  it('admin can save tag mappings', async () => {
    prismaMocks.connectorFieldMapping.create.mockResolvedValue({});
    await expect(
      saveTagMappings('admin', 'user-1', 'customer-a', [
        { ghlTagId: 't1', ghlTagName: 'Lead', internalTag: 'new_lead', direction: 'inbound' },
      ]),
    ).resolves.toBeDefined();
  });
});
