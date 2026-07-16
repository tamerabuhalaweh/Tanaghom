import { PrismaClient, type Role } from '@prisma/client';
import { hashPassword } from '../shared/auth';
import {
  DEFAULT_PRODUCTION_ENTITLEMENTS,
  DEFAULT_PRODUCTION_PLAN_KEY,
} from '../modules/tenant-admin/subscription';

if (process.env.E2E_PRODUCTION_ACCEPTANCE !== 'true') {
  throw new Error('Refusing to manage acceptance fixtures without E2E_PRODUCTION_ACCEPTANCE=true');
}

const action = process.env.E2E_ACCEPTANCE_ACTION || 'seed';
if (!['seed', 'cleanup'].includes(action)) {
  throw new Error('E2E_ACCEPTANCE_ACTION must be seed or cleanup');
}

const acceptancePassword = process.env.E2E_ACCEPTANCE_PASSWORD;
if (action === 'seed' && (!acceptancePassword || acceptancePassword.length < 16)) {
  throw new Error('E2E_ACCEPTANCE_PASSWORD must contain at least 16 characters');
}

const prisma = new PrismaClient();

export const ACCEPTANCE = {
  primaryTenantKey: 'acceptance-primary',
  primaryTenantName: 'Tanaghum Commercial Workspace',
  isolationTenantKey: 'acceptance-isolation',
  isolationTenantName: 'Tanaghum Secondary Workspace',
  departmentName: 'Commercial Portfolio Operations',
  campaignId: '91000000-0000-4000-8000-000000000001',
  contentItemId: '91000000-0000-4000-8000-000000000002',
  draftVersionId: '91000000-0000-4000-8000-000000000003',
  historicalEventId: '91000000-0000-4000-8000-000000000004',
  futureEventId: '91000000-0000-4000-8000-000000000005',
  kpiId: '91000000-0000-4000-8000-000000000006',
  revenueLineId: '91000000-0000-4000-8000-000000000007',
  usdPlanId: '91000000-0000-4000-8000-000000000008',
  assessmentRunId: '91000000-0000-4000-8000-000000000009',
  assessmentEvidenceId: '91000000-0000-4000-8000-000000000010',
  approvedFindingId: '91000000-0000-4000-8000-000000000011',
  rejectedFindingId: '91000000-0000-4000-8000-000000000012',
  accounts: {
    manager: { email: 'acceptance.manager@tanaghum.test', role: 'department_head' },
    cco: { email: 'acceptance.cco@tanaghum.test', role: 'cco' },
    specialist: { email: 'acceptance.specialist@tanaghum.test', role: 'specialist' },
    reviewer: { email: 'acceptance.reviewer@tanaghum.test', role: 'reviewer' },
    viewer: { email: 'acceptance.viewer@tanaghum.test', role: 'viewer' },
    admin: { email: 'acceptance.admin@tanaghum.test', role: 'admin' },
    other: { email: 'acceptance.other@tanaghum.test', role: 'department_head' },
  } satisfies Record<string, { email: string; role: Role }>,
} as const;

const ROLE_NAMES: Record<Role, string> = {
  admin: 'Platform Administrator',
  cco: 'Chief Commercial Officer',
  department_head: 'Commercial Department Head',
  specialist: 'Content Specialist',
  reviewer: 'Commercial Reviewer',
  viewer: 'Executive Viewer',
};

async function ensureActiveSubscription(tenantKey: string, planId: string) {
  const current = await prisma.tenantSubscription.findFirst({
    where: { tenant_key: tenantKey, is_current: true },
  });
  if (current) {
    await prisma.tenantSubscription.update({
      where: { id: current.id },
      data: {
        plan_id: planId,
        status: 'active',
        current_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    return;
  }
  await prisma.tenantSubscription.create({
    data: {
      tenant_key: tenantKey,
      plan_id: planId,
      status: 'active',
      source: 'manual',
      is_current: true,
      current_period_start: new Date(),
      current_period_end: new Date(Date.now() + 24 * 60 * 60 * 1000),
      notes: 'Isolated production acceptance subscription.',
    },
  });
}

async function upsertAcceptanceUser(
  email: string,
  role: Role,
  tenantKey: string,
  departmentId: string,
  passwordHash: string,
) {
  const user = await prisma.user.upsert({
    where: { email },
    update: {
      name: ROLE_NAMES[role],
      tenant_key: tenantKey,
      department_id: departmentId,
      role,
      is_active: true,
      password_hash: passwordHash,
    },
    create: {
      email,
      name: ROLE_NAMES[role],
      password_hash: passwordHash,
      department_id: departmentId,
      tenant_key: tenantKey,
      role,
      is_active: true,
    },
  });
  await prisma.agentRep.upsert({
    where: { user_id: user.id },
    update: { status: 'active' },
    create: {
      user_id: user.id,
      name: `${user.name} AgentRep`,
      agent_type: role === 'cco' || role === 'admin' ? 'governance' : 'functional',
      status: 'active',
    },
  });
  return user;
}

async function seedAcceptanceFixtures() {
  const passwordHash = await hashPassword(acceptancePassword!);
  const [primaryTenant, isolationTenant] = await Promise.all([
    prisma.tenant.upsert({
      where: { tenant_key: ACCEPTANCE.primaryTenantKey },
      update: { name: ACCEPTANCE.primaryTenantName, status: 'active', default_currency: 'AED' },
      create: {
        tenant_key: ACCEPTANCE.primaryTenantKey,
        name: ACCEPTANCE.primaryTenantName,
        status: 'active',
        default_currency: 'AED',
      },
    }),
    prisma.tenant.upsert({
      where: { tenant_key: ACCEPTANCE.isolationTenantKey },
      update: { name: ACCEPTANCE.isolationTenantName, status: 'active', default_currency: 'AED' },
      create: {
        tenant_key: ACCEPTANCE.isolationTenantKey,
        name: ACCEPTANCE.isolationTenantName,
        status: 'active',
        default_currency: 'AED',
      },
    }),
  ]);

  const plan = await prisma.tenantPlan.upsert({
    where: { plan_key: DEFAULT_PRODUCTION_PLAN_KEY },
    update: { status: 'active', entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS },
    create: {
      plan_key: DEFAULT_PRODUCTION_PLAN_KEY,
      name: 'Production Acceptance',
      description: 'Isolated acceptance plan.',
      status: 'active',
      billing_interval: 'monthly',
      currency: 'AED',
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
    },
  });
  await Promise.all([
    ensureActiveSubscription(primaryTenant.tenant_key, plan.id),
    ensureActiveSubscription(isolationTenant.tenant_key, plan.id),
  ]);

  const department = await prisma.department.upsert({
    where: { name: ACCEPTANCE.departmentName },
    update: { description: 'Isolated role-based acceptance department.' },
    create: {
      name: ACCEPTANCE.departmentName,
      description: 'Isolated role-based acceptance department.',
    },
  });

  const users: Record<string, Awaited<ReturnType<typeof upsertAcceptanceUser>>> = {};
  for (const [key, account] of Object.entries(ACCEPTANCE.accounts)) {
    users[key] = await upsertAcceptanceUser(
      account.email,
      account.role,
      key === 'other' ? ACCEPTANCE.isolationTenantKey : ACCEPTANCE.primaryTenantKey,
      department.id,
      passwordHash,
    );
  }
  const manager = users.manager;

  // Re-running the acceptance journey must not leave the shared fixture event or
  // campaign occupied by a prior isolated execution plan.
  await Promise.all([
    prisma.annualCommercialPlan.updateMany({
      where: {
        tenant_key: ACCEPTANCE.primaryTenantKey,
        status: { not: 'archived' },
      },
      data: { status: 'archived', archived_at: new Date() },
    }),
    prisma.commercialPlanEventLink.updateMany({
      where: {
        tenant_key: ACCEPTANCE.primaryTenantKey,
        event_id: ACCEPTANCE.futureEventId,
        status: 'active',
      },
      data: { status: 'archived', archived_at: new Date() },
    }),
    prisma.commercialPlanCampaignLink.updateMany({
      where: {
        tenant_key: ACCEPTANCE.primaryTenantKey,
        campaign_id: ACCEPTANCE.campaignId,
        status: 'active',
      },
      data: { status: 'archived', archived_at: new Date() },
    }),
  ]);

  await prisma.commercialEvent.upsert({
    where: { id: ACCEPTANCE.historicalEventId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      owner_user_id: manager.id,
      status: 'completed',
    },
    create: {
      id: ACCEPTANCE.historicalEventId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      name: 'Historical Leadership Course 2025',
      event_type: 'virtual_event',
      event_date: new Date('2025-06-15T09:00:00.000Z'),
      location: 'Online',
      campaign_start_date: new Date('2025-05-15T09:00:00.000Z'),
      campaign_end_date: new Date('2025-06-15T09:00:00.000Z'),
      expected_attendance: 200,
      revenue_target: 150000,
      planned_budget: 25000,
      owner_user_id: manager.id,
      status: 'completed',
      offer: 'Leadership course for entrepreneurs',
      audience: 'Warm followers and previous buyers',
      geography: 'UAE',
      selected_channels: ['instagram', 'email', 'whatsapp'],
    },
  });
  await prisma.commercialEvent.upsert({
    where: { id: ACCEPTANCE.futureEventId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      owner_user_id: manager.id,
      status: 'planning',
    },
    create: {
      id: ACCEPTANCE.futureEventId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      name: 'Leadership Course Launch',
      event_type: 'virtual_event',
      event_date: new Date('2027-03-20T09:00:00.000Z'),
      location: 'Online',
      campaign_start_date: new Date('2027-02-20T09:00:00.000Z'),
      campaign_end_date: new Date('2027-03-20T09:00:00.000Z'),
      expected_attendance: 300,
      revenue_target: 300000,
      planned_budget: 50000,
      owner_user_id: manager.id,
      status: 'planning',
      offer: 'Advanced leadership course',
      audience: 'Entrepreneurs and previous buyers',
      geography: 'UAE',
      selected_channels: ['instagram', 'ghl', 'whatsapp'],
    },
  });

  await prisma.eventKpiRecord.upsert({
    where: { id: ACCEPTANCE.kpiId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      event_id: ACCEPTANCE.historicalEventId,
      created_by_user_id: manager.id,
    },
    create: {
      id: ACCEPTANCE.kpiId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      event_id: ACCEPTANCE.historicalEventId,
      source_type: 'manual',
      source_name: 'isolated_acceptance_evidence',
      metric_date: new Date('2025-06-16T00:00:00.000Z'),
      channel: 'instagram',
      reach: 120000,
      impressions: 190000,
      interactions: 14500,
      clicks: 4200,
      form_completions: 720,
      leads: 510,
      meetings_booked: 120,
      meetings_attended: 94,
      purchases: 76,
      no_shows: 26,
      spend: 22000,
      currency: 'AED',
      verification_status: 'verified',
      created_by_user_id: manager.id,
      verified_by_user_id: users.cco.id,
      verified_at: new Date('2025-06-17T00:00:00.000Z'),
      verification_reason: 'Controlled acceptance evidence.',
    },
  });

  await prisma.commercialRevenueLine.upsert({
    where: { id: ACCEPTANCE.revenueLineId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      owner_user_id: manager.id,
      created_by_user_id: manager.id,
      status: 'active',
    },
    create: {
      id: ACCEPTANCE.revenueLineId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      revenue_line_type: 'online_course',
      name: 'Online Courses',
      description: 'Isolated annual-planning acceptance revenue line.',
      owner_user_id: manager.id,
      created_by_user_id: manager.id,
    },
  });

  await prisma.commercialPlan.upsert({
    where: { id: ACCEPTANCE.usdPlanId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      revenue_line_id: ACCEPTANCE.revenueLineId,
      currency: 'USD',
      budget_target: 1000,
      revenue_target: 6000,
    },
    create: {
      id: ACCEPTANCE.usdPlanId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      revenue_line_id: ACCEPTANCE.revenueLineId,
      horizon: 'product_or_event',
      stage: 'implementation_engagement',
      title: 'Existing USD Course Plan',
      objective: 'Prove that intentionally stored USD plans are not converted.',
      audience: 'International buyers',
      currency: 'USD',
      budget_target: 1000,
      revenue_target: 6000,
      status: 'active',
      owner_user_id: manager.id,
      created_by_user_id: manager.id,
    },
  });

  await prisma.contentRequest.upsert({
    where: { id: ACCEPTANCE.campaignId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      requester_id: manager.id,
      event_id: ACCEPTANCE.futureEventId,
      owner_department_id: department.id,
      status: 'drafting',
    },
    create: {
      id: ACCEPTANCE.campaignId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      requester_id: manager.id,
      channel: 'social_media',
      raw_message: 'Leadership course campaign',
      objective: 'Convert qualified leadership course demand.',
      audience: 'Entrepreneurs and previous buyers',
      event_id: ACCEPTANCE.futureEventId,
      owner_department_id: department.id,
      target_platforms: ['instagram'],
      content_type: 'campaign',
      risk_category: 'low',
      cta: 'Reserve your place',
      status: 'drafting',
    },
  });
  await prisma.contentItem.upsert({
    where: { id: ACCEPTANCE.contentItemId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      request_id: ACCEPTANCE.campaignId,
      status: 'pending_review',
    },
    create: {
      id: ACCEPTANCE.contentItemId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      request_id: ACCEPTANCE.campaignId,
      platform: 'instagram',
      content_type: 'social_post',
      draft_text: 'Leadership grows when entrepreneurs choose the next responsible action.',
      risk_score: 8,
      risk_reason: 'Low-risk educational message.',
      reach_score: 82,
      reach_breakdown: { hook: 80, clarity: 85, callToAction: 81 },
      status: 'pending_review',
    },
  });
  await prisma.draftVersion.upsert({
    where: { id: ACCEPTANCE.draftVersionId },
    update: { model_used: 'isolated-acceptance-fixture' },
    create: {
      id: ACCEPTANCE.draftVersionId,
      content_item_id: ACCEPTANCE.contentItemId,
      version_no: 1,
      text: 'Leadership grows when entrepreneurs choose the next responsible action.',
      model_used: 'isolated-acceptance-fixture',
    },
  });

  await prisma.commercialHistoricalAssessmentRun.upsert({
    where: { id: ACCEPTANCE.assessmentRunId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      revenue_line_id: ACCEPTANCE.revenueLineId,
      requested_by_user_id: manager.id,
      status: 'generated',
    },
    create: {
      id: ACCEPTANCE.assessmentRunId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      revenue_line_id: ACCEPTANCE.revenueLineId,
      event_ids: [ACCEPTANCE.historicalEventId],
      campaign_ids: [],
      channels: ['instagram'],
      title: '2025 Online Course Learning Review',
      date_from: new Date('2025-01-01T00:00:00.000Z'),
      date_to: new Date('2025-12-31T23:59:59.000Z'),
      status: 'generated',
      evidence_summary: { evidenceCount: 1, currencies: ['AED'], verifiedKpiRows: 1 },
      missing_data: [],
      provider_type: 'acceptance_fixture',
      provider_model: 'evidence-backed-contract',
      requested_by_user_id: manager.id,
      generated_at: new Date('2025-12-31T23:59:59.000Z'),
    },
  });
  await prisma.commercialHistoricalAssessmentEvidence.upsert({
    where: { id: ACCEPTANCE.assessmentEvidenceId },
    update: {
      tenant_key: ACCEPTANCE.primaryTenantKey,
      assessment_run_id: ACCEPTANCE.assessmentRunId,
      source_object_id: ACCEPTANCE.kpiId,
    },
    create: {
      id: ACCEPTANCE.assessmentEvidenceId,
      tenant_key: ACCEPTANCE.primaryTenantKey,
      assessment_run_id: ACCEPTANCE.assessmentRunId,
      evidence_type: 'event_kpi',
      source_object_type: 'event_kpi_record',
      source_object_id: ACCEPTANCE.kpiId,
      source_name: 'Historical Leadership Course 2025 - Instagram',
      metric_key: 'channel_performance',
      metric_value: 22000,
      metric_unit: 'AED',
      observed_at: new Date('2025-06-16T00:00:00.000Z'),
      payload: { purchases: 76, leads: 510, spend: 22000, currency: 'AED' },
    },
  });
  const findings = [
    {
      id: ACCEPTANCE.approvedFindingId,
      type: 'repeat' as const,
      title: 'Repeat the warm-audience launch sequence',
      summary: 'Warm followers and previous buyers produced strong purchase conversion.',
      recommendation: 'Lead with trusted content before paid retargeting and WhatsApp follow-up.',
      confidence: 0.88,
    },
    {
      id: ACCEPTANCE.rejectedFindingId,
      type: 'investigate' as const,
      title: 'Investigate meeting no-show reduction',
      summary: 'Meeting no-shows reduced the qualified sales follow-up yield.',
      recommendation: 'Test a two-step reminder sequence before changing the core funnel.',
      confidence: 0.72,
    },
  ];
  for (const finding of findings) {
    await prisma.commercialHistoricalAssessmentFinding.upsert({
      where: { id: finding.id },
      update: {
        tenant_key: ACCEPTANCE.primaryTenantKey,
        assessment_run_id: ACCEPTANCE.assessmentRunId,
        decision: 'pending',
        decision_reason: null,
        decided_by_user_id: null,
        decided_at: null,
        learning_set_id: null,
      },
      create: {
        id: finding.id,
        tenant_key: ACCEPTANCE.primaryTenantKey,
        assessment_run_id: ACCEPTANCE.assessmentRunId,
        finding_type: finding.type,
        title: finding.title,
        summary: finding.summary,
        recommendation: finding.recommendation,
        confidence: finding.confidence,
        evidence_ids: [ACCEPTANCE.assessmentEvidenceId],
      },
    });
  }

  console.log(JSON.stringify({
    status: 'ready',
    primaryTenantKey: ACCEPTANCE.primaryTenantKey,
    isolationTenantKey: ACCEPTANCE.isolationTenantKey,
    campaignId: ACCEPTANCE.campaignId,
    contentItemId: ACCEPTANCE.contentItemId,
    historicalAssessmentId: ACCEPTANCE.assessmentRunId,
    findingIds: [ACCEPTANCE.approvedFindingId, ACCEPTANCE.rejectedFindingId],
    accounts: Object.fromEntries(
      Object.entries(ACCEPTANCE.accounts).map(([key, account]) => [key, account.email]),
    ),
  }));
}

async function cleanupAcceptanceFixtures() {
  const emails = Object.values(ACCEPTANCE.accounts).map(account => account.email);
  await prisma.$transaction([
    prisma.user.updateMany({ where: { email: { in: emails } }, data: { is_active: false } }),
    prisma.tenantSubscription.updateMany({
      where: { tenant_key: { in: [ACCEPTANCE.primaryTenantKey, ACCEPTANCE.isolationTenantKey] } },
      data: { status: 'suspended', is_current: false },
    }),
    prisma.tenant.updateMany({
      where: { tenant_key: { in: [ACCEPTANCE.primaryTenantKey, ACCEPTANCE.isolationTenantKey] } },
      data: { status: 'archived' },
    }),
  ]);
  console.log(JSON.stringify({ status: 'cleaned', disabledUsers: emails.length }));
}

(action === 'cleanup' ? cleanupAcceptanceFixtures() : seedAcceptanceFixtures())
  .finally(async () => prisma.$disconnect());
