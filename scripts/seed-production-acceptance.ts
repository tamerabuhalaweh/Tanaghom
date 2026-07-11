import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/auth';
import {
  DEFAULT_PRODUCTION_ENTITLEMENTS,
  DEFAULT_PRODUCTION_PLAN_KEY,
} from '../modules/tenant-admin/subscription';

if (process.env.E2E_PRODUCTION_ACCEPTANCE !== 'true') {
  throw new Error('Refusing to seed acceptance fixtures without E2E_PRODUCTION_ACCEPTANCE=true');
}

const prisma = new PrismaClient();

const FIXTURES = {
  tenantKey: 'acceptance-isolation',
  tenantName: 'Acceptance Isolation Tenant',
  otherUserEmail: 'acceptance.other@tanaghum.test',
  campaignId: '91000000-0000-4000-8000-000000000001',
  contentItemId: '91000000-0000-4000-8000-000000000002',
  draftVersionId: '91000000-0000-4000-8000-000000000003',
} as const;

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

async function seedAcceptanceFixtures() {
  const [defaultTenant, isolationTenant] = await Promise.all([
    prisma.tenant.upsert({
      where: { tenant_key: 'default' },
      update: { name: 'Tanaghum Acceptance Tenant', status: 'active' },
      create: { tenant_key: 'default', name: 'Tanaghum Acceptance Tenant', status: 'active' },
    }),
    prisma.tenant.upsert({
      where: { tenant_key: FIXTURES.tenantKey },
      update: { name: FIXTURES.tenantName, status: 'active' },
      create: { tenant_key: FIXTURES.tenantKey, name: FIXTURES.tenantName, status: 'active' },
    }),
  ]);

  const plan = await prisma.tenantPlan.upsert({
    where: { plan_key: DEFAULT_PRODUCTION_PLAN_KEY },
    update: { status: 'active', entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS },
    create: {
      plan_key: DEFAULT_PRODUCTION_PLAN_KEY,
      name: 'Production Acceptance',
      description: 'Isolated CI acceptance plan.',
      status: 'active',
      billing_interval: 'monthly',
      currency: 'USD',
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
    },
  });
  await Promise.all([
    ensureActiveSubscription(defaultTenant.tenant_key, plan.id),
    ensureActiveSubscription(isolationTenant.tenant_key, plan.id),
  ]);

  const department = await prisma.department.upsert({
    where: { name: 'Brand & Market Intelligence' },
    update: { description: 'Production acceptance commercial department.' },
    create: {
      name: 'Brand & Market Intelligence',
      description: 'Production acceptance commercial department.',
    },
  });

  const passwordHash = await hashPassword('password123');
  const manager = await prisma.user.upsert({
    where: { email: 'brand.head@tanaghum.com' },
    update: {
      tenant_key: 'default',
      department_id: department.id,
      role: 'department_head',
      is_active: true,
      password_hash: passwordHash,
    },
    create: {
      email: 'brand.head@tanaghum.com',
      name: 'Acceptance Commercial Manager',
      password_hash: passwordHash,
      department_id: department.id,
      tenant_key: 'default',
      role: 'department_head',
      is_active: true,
    },
  });
  const cco = await prisma.user.upsert({
    where: { email: 'cco@tanaghum.com' },
    update: {
      tenant_key: 'default',
      role: 'cco',
      is_active: true,
      password_hash: passwordHash,
    },
    create: {
      email: 'cco@tanaghum.com',
      name: 'Acceptance CCO',
      password_hash: passwordHash,
      tenant_key: 'default',
      role: 'cco',
      is_active: true,
    },
  });

  const managerAgentRep = await prisma.agentRep.upsert({
    where: { user_id: manager.id },
    update: { status: 'active' },
    create: {
      user_id: manager.id,
      name: 'Acceptance Commercial Manager AgentRep',
      agent_type: 'functional',
      status: 'active',
    },
  });
  await prisma.agentRep.upsert({
    where: { user_id: cco.id },
    update: { status: 'active' },
    create: {
      user_id: cco.id,
      name: 'Acceptance CCO AgentRep',
      agent_type: 'governance',
      status: 'active',
    },
  });

  const otherUser = await prisma.user.upsert({
    where: { email: FIXTURES.otherUserEmail },
    update: {
      tenant_key: FIXTURES.tenantKey,
      role: 'department_head',
      is_active: true,
      password_hash: await hashPassword('acceptance-password-123'),
    },
    create: {
      email: FIXTURES.otherUserEmail,
      name: 'Other Tenant Manager',
      tenant_key: FIXTURES.tenantKey,
      role: 'department_head',
      is_active: true,
      password_hash: await hashPassword('acceptance-password-123'),
    },
  });

  await prisma.agentRep.upsert({
    where: { user_id: otherUser.id },
    update: { status: 'active' },
    create: {
      user_id: otherUser.id,
      name: 'Other Tenant Manager AgentRep',
      agent_type: 'functional',
      status: 'active',
    },
  });

  await prisma.contentRequest.upsert({
    where: { id: FIXTURES.campaignId },
    update: {
      tenant_key: 'default',
      requester_id: manager.id,
      raw_message: 'Production acceptance leadership campaign',
      objective: 'Convert qualified leadership course demand without external execution.',
      audience: 'Entrepreneurs and previous buyers',
      owner_department_id: department.id,
      target_platforms: ['instagram'],
      status: 'drafting',
    },
    create: {
      id: FIXTURES.campaignId,
      tenant_key: 'default',
      requester_id: manager.id,
      channel: 'social_media',
      raw_message: 'Production acceptance leadership campaign',
      objective: 'Convert qualified leadership course demand without external execution.',
      audience: 'Entrepreneurs and previous buyers',
      owner_department_id: department.id,
      target_platforms: ['instagram'],
      content_type: 'campaign',
      risk_category: 'low',
      cta: 'Reserve your place',
      status: 'drafting',
    },
  });

  await prisma.contentItem.upsert({
    where: { id: FIXTURES.contentItemId },
    update: {
      tenant_key: 'default',
      request_id: FIXTURES.campaignId,
      draft_text: 'Leadership grows when entrepreneurs choose the next responsible action.',
      status: 'pending_review',
    },
    create: {
      id: FIXTURES.contentItemId,
      tenant_key: 'default',
      request_id: FIXTURES.campaignId,
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
    where: { id: FIXTURES.draftVersionId },
    update: {
      text: 'Leadership grows when entrepreneurs choose the next responsible action.',
      model_used: 'acceptance-fixture',
    },
    create: {
      id: FIXTURES.draftVersionId,
      content_item_id: FIXTURES.contentItemId,
      version_no: 1,
      text: 'Leadership grows when entrepreneurs choose the next responsible action.',
      model_used: 'acceptance-fixture',
    },
  });

  console.log(JSON.stringify({
    status: 'ready',
    tenantKey: FIXTURES.tenantKey,
    campaignId: FIXTURES.campaignId,
    contentItemId: FIXTURES.contentItemId,
    managerAgentRepId: managerAgentRep.id,
  }));
}

seedAcceptanceFixtures()
  .finally(async () => prisma.$disconnect());
