import { describe, expect, it } from 'vitest';
import { buildCommercialWorkflowState, type CommercialWorkflowFacts } from './workflow-state';

const baseFacts: CommercialWorkflowFacts = {
  generatedAt: '2026-06-27T12:00:00.000Z',
  campaign: null,
  provider: {
    ready: false,
    label: 'Connect OpenAI or Claude',
    provider: 'mock',
    credentialStatus: 'missing',
  },
  postiz: {
    serverReachable: true,
    credentialStatus: 'missing',
    integrationIdStatus: 'missing',
    connectedChannelCount: 0,
  },
  safety: {
    externalExecutionEnabled: false,
    m5WriteExecutionEnabled: false,
    demoMode: false,
  },
  counts: {
    activeCampaigns: 0,
    generatedDrafts: 0,
    scoredDrafts: 0,
    pendingApprovals: 0,
    approvedApprovals: 0,
    publishingPackages: 0,
    analyticsReports: 0,
    capturedLeads: 0,
    qualifiedLeads: 0,
  },
  current: {
    draftCount: 0,
    scoredDraftCount: 0,
    latestApprovalStatus: null,
    packageReady: false,
    analyticsReports: 0,
    leadCount: 0,
  },
};

describe('commercial workflow state builder', () => {
  it('starts at campaign brief when no campaign exists', () => {
    const state = buildCommercialWorkflowState(baseFacts);

    expect(state.sourceOfTruth).toBe('STITCH');
    expect(state.mode).toBe('derived_from_backend_records');
    expect(state.stages[0]).toMatchObject({ id: 'brief', state: 'active' });
    expect(state.nextAction).toMatchObject({ label: 'Create or select campaign', href: '/ideas' });
  });

  it('blocks draft generation when a campaign exists but no real provider is ready', () => {
    const state = buildCommercialWorkflowState({
      ...baseFacts,
      campaign: {
        id: 'campaign-1',
        title: 'CEO launch campaign',
        objective: 'Generate qualified leads',
        status: 'idea',
        riskCategory: 'medium',
        platforms: ['linkedin', 'instagram', 'x'],
      },
      counts: { ...baseFacts.counts, activeCampaigns: 1 },
    });

    expect(state.stages.find(stage => stage.id === 'draft')).toMatchObject({
      state: 'blocked',
      blockingReason: 'LLM provider is not ready.',
    });
    expect(state.nextAction).toMatchObject({ label: 'Connect AI provider', href: '/ai-settings' });
  });

  it('moves through score, approval, and package using actual workflow facts', () => {
    const state = buildCommercialWorkflowState({
      ...baseFacts,
      campaign: {
        id: 'campaign-1',
        title: 'CEO launch campaign',
        objective: 'Generate qualified leads',
        status: 'pending_review',
        riskCategory: 'medium',
        platforms: ['linkedin', 'instagram', 'x'],
      },
      provider: {
        ready: true,
        label: 'OpenAI / gpt-4o',
        provider: 'openai',
        credentialStatus: 'configured',
      },
      counts: {
        ...baseFacts.counts,
        activeCampaigns: 1,
        generatedDrafts: 3,
        scoredDrafts: 1,
        approvedApprovals: 1,
        publishingPackages: 1,
      },
      current: {
        ...baseFacts.current,
        draftCount: 3,
        scoredDraftCount: 1,
        latestApprovalStatus: 'approved',
        packageReady: true,
      },
    });

    expect(state.stages.find(stage => stage.id === 'draft')?.state).toBe('done');
    expect(state.stages.find(stage => stage.id === 'optimize')?.state).toBe('done');
    expect(state.stages.find(stage => stage.id === 'approval')?.state).toBe('done');
    expect(state.stages.find(stage => stage.id === 'package')?.state).toBe('done');
  });

  it('keeps Postiz blocked after package creation until a selected channel exists', () => {
    const state = buildCommercialWorkflowState({
      ...baseFacts,
      campaign: {
        id: 'campaign-1',
        title: 'CEO launch campaign',
        objective: 'Generate qualified leads',
        status: 'approved',
        riskCategory: 'low',
        platforms: ['linkedin'],
      },
      provider: {
        ready: true,
        label: 'Claude / sonnet',
        provider: 'claude',
        credentialStatus: 'configured',
      },
      postiz: {
        serverReachable: true,
        credentialStatus: 'configured',
        integrationIdStatus: 'missing',
        connectedChannelCount: 0,
      },
      current: {
        draftCount: 1,
        scoredDraftCount: 1,
        latestApprovalStatus: 'approved',
        packageReady: true,
        analyticsReports: 0,
        leadCount: 0,
      },
      counts: {
        ...baseFacts.counts,
        activeCampaigns: 1,
        generatedDrafts: 1,
        scoredDrafts: 1,
        approvedApprovals: 1,
        publishingPackages: 1,
      },
    });

    expect(state.stages.find(stage => stage.id === 'postiz')).toMatchObject({
      state: 'blocked',
      blockingReason: 'No Postiz social channel is visible.',
    });
    expect(state.postiz.label).toBe('Requires Channel');
  });

  it('never marks external execution or M5 as enabled unless flags are true', () => {
    const state = buildCommercialWorkflowState(baseFacts);

    expect(state.safety.externalWritesBlocked).toBe(true);
    expect(state.safety.m5Disabled).toBe(true);
    expect(state.readiness.blockers).toContain('External execution kill switch is disabled.');
    expect(state.readiness.blockers).toContain('M5 write execution is disabled.');
  });
});
