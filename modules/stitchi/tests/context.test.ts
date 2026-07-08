import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
  },
  commercialEvent: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  leadCaptureRecord: {
    findMany: vi.fn(),
  },
  eventKpiRecord: {
    findMany: vi.fn(),
  },
  eventProblem: {
    findMany: vi.fn(),
  },
  integrationCredential: {
    findMany: vi.fn(),
  },
  connectorImportJob: {
    findMany: vi.fn(),
  },
  commercialRevenueLine: {
    findMany: vi.fn(),
  },
  commercialPlan: {
    findMany: vi.fn(),
  },
  commercialAssessmentSignal: {
    findMany: vi.fn(),
  },
  commercialExecutiveReport: {
    findMany: vi.fn(),
  },
  commercialExecutiveReportSchedule: {
    findMany: vi.fn(),
  },
}));

const ghlSyncMocks = vi.hoisted(() => ({
  getGhlSyncStatus: vi.fn(),
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('../../ghl-sync/repository', () => ghlSyncMocks);

import { formatReadOnlyContextForPrompt, loadReadOnlyContext } from '../context';

const conversation = {
  id: 'conversation-1',
  tenantKey: 'tenant-a',
  userId: 'user-1',
  eventId: 'event-1',
  title: 'Plan event',
  status: 'active' as const,
  createdAt: new Date('2026-07-08T12:00:00Z'),
  updatedAt: new Date('2026-07-08T12:00:00Z'),
};

const decimal = (value: string) => ({ toString: () => value });

describe('Stitchi read-only context loader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.user.findFirst.mockResolvedValue({
      id: 'user-1',
      name: 'Marketing Manager',
      email: 'marketing@example.com',
      role: 'department_head',
      department: { name: 'Commercial' },
    });
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({
      id: 'event-1',
      name: 'Leadership Course Launch',
      status: 'active',
      event_type: 'business_camp',
      event_date: new Date('2026-08-02T00:00:00Z'),
      location: 'Dubai',
      planned_budget: decimal('35000'),
      revenue_target: decimal('120000'),
      selected_channels: ['instagram', 'email'],
    });
    prismaMocks.commercialEvent.findMany.mockResolvedValue([
      {
        id: 'event-1',
        name: 'Leadership Course Launch',
        status: 'active',
        event_type: 'business_camp',
        event_date: new Date('2026-08-02T00:00:00Z'),
        location: 'Dubai',
        planned_budget: decimal('35000'),
        revenue_target: decimal('120000'),
        selected_channels: ['instagram', 'email'],
      },
    ]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([
      { lead_status: 'meeting_booked', lead_temperature: 'hot', purchase_amount: decimal('0') },
      { lead_status: 'purchased', lead_temperature: 'buyer', purchase_amount: decimal('2500') },
    ]);
    prismaMocks.eventKpiRecord.findMany.mockResolvedValue([
      {
        reach: 1000,
        impressions: 1800,
        interactions: 120,
        clicks: 40,
        form_completions: 10,
        leads: 8,
        meetings_booked: 3,
        meetings_attended: 2,
        purchases: 1,
        no_shows: 1,
        spend: decimal('250'),
      },
    ]);
    prismaMocks.eventProblem.findMany.mockResolvedValue([
      { title: 'WhatsApp follow-up delayed', severity: 'critical', category: 'sales' },
    ]);
    prismaMocks.integrationCredential.findMany.mockResolvedValue([
      { id: 'cred-ghl', provider: 'gohighlevel', credential_type: 'api_key', last_validated_at: new Date('2026-07-08T08:00:00Z') },
      { id: 'cred-kajabi', provider: 'kajabi', credential_type: 'oauth_client', last_validated_at: null },
    ]);
    prismaMocks.connectorImportJob.findMany.mockResolvedValue([
      {
        connector_id: 'kajabi',
        sync_status: 'ready_for_sync',
        state: 'test_passed',
        last_dry_run_at: new Date('2026-07-08T09:00:00Z'),
        last_sync_at: null,
      },
      {
        connector_id: 'meta_analytics',
        sync_status: 'blocked',
        state: 'blocked',
        last_dry_run_at: null,
        last_sync_at: null,
      },
    ]);
    ghlSyncMocks.getGhlSyncStatus.mockResolvedValue({
      tenantKey: 'tenant-a',
      eventId: 'event-1',
      sourceOfTruth: 'gohighlevel',
      tanaghumRole: 'operating_reporting_layer',
      credentialStatus: 'configured',
      mappingStatus: 'partial',
      readSyncEnabled: false,
      writeBackEnabled: false,
      acceptance: {
        status: 'requires_mapping',
        readyForReadSync: false,
        customerAction: 'Map GoHighLevel stages.',
        systemAction: 'Validate mappings before sync.',
        readOnly: true,
        externalWritesAllowed: false,
        rawSecretsReturned: false,
      },
      ghlLeadCount: 4,
      lastSyncAt: new Date('2026-07-08T10:00:00Z'),
      lastRun: null,
      requiredActions: ['Map a GoHighLevel pipeline stage for Purchased.'],
    });
    prismaMocks.commercialRevenueLine.findMany.mockResolvedValue([
      {
        id: 'revenue-line-1',
        revenue_line_type: 'online_course',
        name: 'Online Courses',
        status: 'active',
        _count: { plans: 1, assessment_signals: 0 },
      },
    ]);
    prismaMocks.commercialPlan.findMany.mockResolvedValue([
      {
        id: 'plan-1',
        title: 'Course Launch Plan',
        stage: 'strategy_planning',
        status: 'draft',
        budget_target: decimal('5000'),
        revenue_target: decimal('30000'),
        linked_event_id: 'event-1',
        revenue_line: { name: 'Online Courses' },
      },
    ]);
    prismaMocks.commercialAssessmentSignal.findMany.mockResolvedValue([]);
    prismaMocks.commercialExecutiveReport.findMany.mockResolvedValue([
      {
        title: 'Weekly commercial executive report',
        status: 'preview',
        confidence: 'medium',
        created_at: new Date('2026-07-08T11:00:00Z'),
      },
    ]);
    prismaMocks.commercialExecutiveReportSchedule.findMany.mockResolvedValue([
      { id: 'schedule-1' },
    ]);
  });

  it('loads summarized tenant-scoped event context without exposing secrets', async () => {
    const context = await loadReadOnlyContext('tenant-a', conversation, 'event-1', 'marketing_manager');

    expect(context.currentUser).toMatchObject({
      id: 'user-1',
      name: 'Marketing Manager',
      role: 'marketing_manager',
      departmentName: 'Commercial',
    });
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'event-1', tenant_key: 'tenant-a' },
    }));
    expect(prismaMocks.leadCaptureRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: 'event-1' },
    }));
    expect(context.selectedEvent?.name).toBe('Leadership Course Launch');
    expect(context.leadSummary.total).toBe(2);
    expect(context.leadSummary.byStatus.purchased).toBe(1);
    expect(context.leadSummary.knownRevenue).toBe(2500);
    expect(context.kpiSummary.reach).toBe(1000);
    expect(context.kpiSummary.spend).toBe(250);
    expect(context.riskSummary.critical).toBe(1);
    expect(context.connectorSummary.readyForSync).toBe(1);
    expect(context.unifiedDataLayer.kajabi).toMatchObject({
      provider: 'kajabi',
      credentialStatus: 'configured',
      importJobStatus: 'ready_for_sync',
    });
    expect(context.unifiedDataLayer.whatsappFollowUp).toMatchObject({
      sourceOfTruth: 'gohighlevel',
      ghlCredentialStatus: 'configured',
      whatsappCredentialStatus: 'missing',
      externalWritesAllowed: false,
    });
    expect(context.unifiedDataLayer.smartLabsVoice).toMatchObject({
      credentialStatus: 'missing',
      readyForHandoffPreview: true,
      externalCallsAllowed: false,
    });
    expect(context.ghlCrm).toMatchObject({
      sourceOfTruth: 'gohighlevel',
      tanaghumRole: 'operating_reporting_layer',
      credentialStatus: 'configured',
      mappingStatus: 'partial',
      readinessStatus: 'requires_mapping',
      readyForReadSync: false,
      mirroredLeadCount: 4,
      requiredActions: ['Map a GoHighLevel pipeline stage for Purchased.'],
      rawSecretsReturned: false,
    });
    expect(context.commercialCenter.revenueLines[0]).toMatchObject({
      id: 'revenue-line-1',
      type: 'online_course',
      name: 'Online Courses',
    });
    expect(context.commercialExecutive).toMatchObject({
      recentReports: 1,
      activeSchedules: 1,
      latestReportTitle: 'Weekly commercial executive report',
      latestReportStatus: 'preview',
      latestReportConfidence: 'medium',
      requiredActions: [],
    });
    expect(context.guardrails).toEqual({
      mode: 'read_only',
      writesExecuted: false,
      externalExecution: 'blocked',
      secretsReturned: false,
    });
    const promptContext = formatReadOnlyContextForPrompt(context);
    expect(promptContext).not.toContain('encrypted_payload');
    expect(promptContext).not.toContain('raw-secret');
    expect(promptContext).not.toContain('api_key');
    expect(promptContext).toContain('gohighlevel');
    expect(promptContext).toContain('requires_mapping');
  });
});
