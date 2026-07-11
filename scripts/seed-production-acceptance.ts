import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/auth';

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

async function seedAcceptanceFixtures() {
  const manager = await prisma.user.findUnique({ where: { email: 'brand.head@tanaghum.com' } });
  if (!manager) throw new Error('Run prisma/seed.ts before the production acceptance seed');

  const managerAgentRep = await prisma.agentRep.findUnique({ where: { user_id: manager.id } });
  if (!managerAgentRep) throw new Error('Manager AgentRep is required for production acceptance');

  const department = await prisma.department.findUnique({ where: { name: 'Brand & Market Intelligence' } });
  if (!department) throw new Error('Brand & Market Intelligence department is required');

  await prisma.tenant.upsert({
    where: { tenant_key: FIXTURES.tenantKey },
    update: { name: FIXTURES.tenantName, status: 'active' },
    create: { tenant_key: FIXTURES.tenantKey, name: FIXTURES.tenantName, status: 'active' },
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
