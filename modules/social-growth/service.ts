import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { ForbiddenError, NotFoundError, ValidationError } from '@shared/errors';
import type { ContentType, RiskCategory } from '@prisma/client';
import {
  ALGORITHM_GUIDANCE_RULES,
  ALGORITHM_KNOWLEDGE_SOURCES,
  COURSE_CAMPAIGN_TEMPLATES,
  type CourseCampaignTemplate,
} from './data';

type GrowthSession = {
  tenantKey: string;
  humanUserId: string;
  role: string;
};

type TemplateCampaignInput = {
  templateId: string;
  ownerDepartmentId?: string;
  overrides?: {
    topic?: string;
    objective?: string;
    audience?: string;
    cta?: string;
    targetPlatforms?: string[];
    riskCategory?: 'low' | 'medium' | 'high';
  };
};

const CAMPAIGN_CREATE_ROLES = new Set(['admin', 'cco', 'department_head', 'specialist']);

function assertCanCreateCampaign(role: string): void {
  if (!CAMPAIGN_CREATE_ROLES.has(role)) {
    throw new ForbiddenError('This role cannot create course-sales campaigns');
  }
}

function numberFromMetric(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function recordMetric(record: unknown, key: string): number {
  if (!record || typeof record !== 'object') return 0;
  return numberFromMetric((record as Record<string, unknown>)[key]);
}

function templateById(id: string): CourseCampaignTemplate {
  const template = COURSE_CAMPAIGN_TEMPLATES.find(item => item.id === id);
  if (!template) throw new NotFoundError('Course campaign template', id);
  return template;
}

async function resolveOwnerDepartmentId(ownerDepartmentId?: string): Promise<string | null> {
  if (ownerDepartmentId) {
    const department = await prisma.department.findUnique({ where: { id: ownerDepartmentId }, select: { id: true } });
    if (!department) throw new ValidationError('Department not found', { ownerDepartmentId: `Department ${ownerDepartmentId} does not exist` });
    return department.id;
  }

  const preferred = await prisma.department.findFirst({
    where: { name: { in: ['Brand & Market Intelligence', 'Commercial', 'Marketing', 'Social Media'] } },
    orderBy: { name: 'asc' },
    select: { id: true },
  });
  if (preferred) return preferred.id;

  const fallback = await prisma.department.findFirst({ orderBy: { name: 'asc' }, select: { id: true } });
  return fallback?.id || null;
}

export function listCourseCampaignTemplates() {
  return {
    templates: COURSE_CAMPAIGN_TEMPLATES,
    _label: 'Course-sales campaign templates loaded from product registry',
  };
}

export async function createCampaignFromTemplate(session: GrowthSession, input: TemplateCampaignInput) {
  assertCanCreateCampaign(session.role);

  const template = templateById(input.templateId);
  const ownerDepartmentId = await resolveOwnerDepartmentId(input.ownerDepartmentId);
  const override = input.overrides || {};
  const targetPlatforms = override.targetPlatforms?.length ? override.targetPlatforms : template.targetPlatforms;

  if (!targetPlatforms.length) {
    throw new ValidationError('At least one target platform is required', { targetPlatforms: 'Choose at least one platform' });
  }

  const campaign = await prisma.contentRequest.create({
    data: {
      tenant_key: session.tenantKey,
      requester_id: session.humanUserId,
      channel: 'course_sales_template',
      raw_message: override.topic || template.topic,
      objective: override.objective || template.objective,
      audience: override.audience || template.audience,
      cta: override.cta || template.cta,
      content_type: template.contentType as ContentType,
      risk_category: (override.riskCategory || template.riskCategory) as RiskCategory,
      target_platforms: targetPlatforms,
      media_refs: {
        requirements: template.mediaRequirements,
        sourceTemplateId: template.id,
        expectedOutcome: template.expectedOutcome,
        recommendedFunnel: template.recommendedFunnel,
      },
      owner_department_id: ownerDepartmentId,
      status: 'idea',
    },
  });

  auditLog(
    {
      actor: `user:${session.humanUserId}`,
      action: 'course_sales_campaign_template_created',
      object_type: 'content_request',
      object_id: campaign.id,
      result: 'success',
    },
    `Course-sales campaign created from template ${template.id}`,
  );

  return {
    id: campaign.id,
    topic: campaign.raw_message,
    objective: campaign.objective,
    audience: campaign.audience,
    targetPlatforms: campaign.target_platforms,
    cta: campaign.cta,
    contentType: campaign.content_type,
    riskCategory: campaign.risk_category,
    status: campaign.status,
    template: {
      id: template.id,
      name: template.name,
      expectedOutcome: template.expectedOutcome,
      recommendedFunnel: template.recommendedFunnel,
    },
    _label: 'Course-sales campaign created and ready for AI drafting',
  };
}

export async function getAlgorithmKnowledgePack(tenantKey: string) {
  const storedRules = await prisma.platformRule.findMany({
    orderBy: [{ platform: 'asc' }, { rule_type: 'asc' }],
    take: 100,
  });
  const sourcesById = new Map(ALGORITHM_KNOWLEDGE_SOURCES.map(source => [source.id, source]));

  return {
    packId: 'social-growth-course-sales-v1',
    status: storedRules.length ? 'active_with_operator_rules' : 'baseline_guidance_requires_review',
    tenantKey,
    privateAlgorithmImported: false,
    sourceOfTruth: 'Tanaghum governed knowledge pack plus customer-owned analytics',
    disclaimer:
      'The platform does not import or claim access to private platform algorithms. It uses official/public guidance, approved rules, and customer-owned performance data.',
    sources: ALGORITHM_KNOWLEDGE_SOURCES,
    guidanceRules: ALGORITHM_GUIDANCE_RULES.map(rule => ({
      ...rule,
      source: sourcesById.get(rule.sourceId),
    })),
    storedPlatformRules: storedRules.map(rule => ({
      id: rule.id,
      platform: rule.platform,
      ruleType: rule.rule_type,
      ruleValue: rule.rule_value,
      sourceUrl: rule.source_url,
      sourceType: rule.source_type,
      confidence: rule.confidence,
      lastReviewedAt: rule.last_reviewed_at,
      nextReviewAt: rule.next_review_at,
    })),
    nextSteps: [
      'Review and approve official/public guidance before treating it as active scoring policy.',
      'Connect official social analytics to replace generic guidance with tenant-owned performance signals.',
      'Use the scoring engine to convert approved guidance into platform-specific recommendations.',
    ],
    _label: 'Social algorithm knowledge pack loaded',
  };
}

export async function buildSocialGrowthSummary(session: GrowthSession) {
  const tenantKey = session.tenantKey;
  const tenantUsers = await prisma.user.findMany({
    where: { tenant_key: tenantKey },
    select: { id: true },
  });
  const tenantUserIds = tenantUsers.map(user => user.id);

  const [
    campaignCount,
    draftCount,
    pendingApprovals,
    approvedApprovals,
    packageCount,
    totalLeads,
    qualifiedLeads,
    nurturingLeads,
    snapshots,
    analyticsSourceCount,
    llmCredentialCount,
    integrationCredentials,
    recentCampaigns,
    recentLeads,
  ] = await Promise.all([
    prisma.contentRequest.count({ where: { tenant_key: tenantKey } }),
    prisma.contentItem.count({ where: { tenant_key: tenantKey } }),
    prisma.approval.count({ where: { tenant_key: tenantKey, approval_status: 'pending' } }),
    prisma.approval.count({ where: { tenant_key: tenantKey, approval_status: 'approved' } }),
    prisma.publishingPackage.count({ where: { tenant_key: tenantKey } }),
    prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey } }),
    prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey, lead_status: 'qualified' } }),
    prisma.leadCaptureRecord.count({ where: { tenant_key: tenantKey, lead_status: 'nurturing' } }),
    prisma.analyticsSnapshot.findMany({
      where: { tenant_key: tenantKey },
      select: { normalized_metrics: true, metrics: true, platform: true, collected_at: true },
      orderBy: { collected_at: 'desc' },
      take: 200,
    }),
    prisma.analyticsSource.count({ where: { status: 'active' } }),
    tenantUserIds.length
      ? prisma.llmProviderCredential.count({ where: { owner_user_id: { in: tenantUserIds }, is_active: true } })
      : Promise.resolve(0),
    prisma.integrationCredential.findMany({
      where: { tenant_key: tenantKey, is_active: true },
      select: { provider: true, credential_type: true, connection_key: true, display_name: true, updated_at: true },
      orderBy: { updated_at: 'desc' },
    }),
    prisma.contentRequest.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        raw_message: true,
        objective: true,
        cta: true,
        target_platforms: true,
        status: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    }),
    prisma.leadCaptureRecord.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        lead_status: true,
        platform: true,
        consent_status: true,
        campaign_id: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 5,
    }),
  ]);

  const normalizedTotals = snapshots.reduce(
    (acc, snapshot) => {
      const metrics = snapshot.normalized_metrics || snapshot.metrics;
      return {
        reach: acc.reach + recordMetric(metrics, 'reach'),
        impressions: acc.impressions + recordMetric(metrics, 'impressions'),
        engagement: acc.engagement + recordMetric(metrics, 'engagement'),
        clicks: acc.clicks + recordMetric(metrics, 'clicks'),
      };
    },
    { reach: 0, impressions: 0, engagement: 0, clicks: 0 },
  );

  const credentialProviders = new Set(integrationCredentials.map(credential => credential.provider));
  const postizReady = credentialProviders.has('postiz');
  const ghlReady = credentialProviders.has('gohighlevel');
  const smartLabsReady = credentialProviders.has('smartlabs_voice');
  const socialOAuthReady = credentialProviders.has('social_oauth');
  const analyticsConnected = analyticsSourceCount > 0 || snapshots.length > 0;

  const readinessFactors = [
    campaignCount > 0,
    llmCredentialCount > 0,
    draftCount > 0,
    approvedApprovals > 0,
    packageCount > 0,
    postizReady,
    analyticsConnected,
    totalLeads > 0,
    ghlReady,
    smartLabsReady,
  ];
  const readinessScore = Math.round((readinessFactors.filter(Boolean).length / readinessFactors.length) * 100);

  const conversionRate = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0;
  const engagementRate = normalizedTotals.impressions > 0
    ? Number(((normalizedTotals.engagement / normalizedTotals.impressions) * 100).toFixed(1))
    : 0;

  return {
    tenantKey,
    profile: {
      productFocus: 'Social growth and course-sales engine',
      audience: 'Followers, warm course prospects, and coaching/event buyers',
      promise:
        'Shorten content production time, improve engagement quality, capture leads, and prepare CRM/voice handoff.',
    },
    kpis: {
      activeCampaigns: campaignCount,
      postsPrepared: draftCount,
      awaitingReview: pendingApprovals,
      approvedContent: approvedApprovals,
      schedulingPackages: packageCount,
      capturedLeads: totalLeads,
      qualifiedLeads,
      nurturingLeads,
      courseCtaClicks: normalizedTotals.clicks,
      engagementRate,
      leadQualificationRate: conversionRate,
      growthReadinessScore: readinessScore,
    },
    integrations: {
      aiModel: llmCredentialCount > 0 ? 'configured' : 'requires_credentials',
      postiz: postizReady ? 'configured' : 'requires_credentials',
      officialSocialAnalytics: analyticsConnected ? 'data_available' : 'requires_official_api',
      goHighLevel: ghlReady ? 'configured' : 'requires_credentials',
      smartLabsVoice: smartLabsReady ? 'configured' : 'requires_credentials',
      socialOAuth: socialOAuthReady ? 'configured' : 'requires_credentials',
    },
    funnel: [
      { label: 'Campaigns', value: campaignCount },
      { label: 'Drafts', value: draftCount },
      { label: 'Approved', value: approvedApprovals },
      { label: 'Packages', value: packageCount },
      { label: 'Leads', value: totalLeads },
      { label: 'Qualified', value: qualifiedLeads },
    ],
    recentCampaigns: recentCampaigns.map(campaign => ({
      id: campaign.id,
      topic: campaign.raw_message,
      objective: campaign.objective,
      cta: campaign.cta,
      platforms: campaign.target_platforms,
      status: campaign.status,
      createdAt: campaign.created_at,
    })),
    recentLeads: recentLeads.map(lead => ({
      id: lead.id,
      status: lead.lead_status,
      platform: lead.platform || 'manual',
      consentStatus: lead.consent_status,
      campaignId: lead.campaign_id,
      createdAt: lead.created_at,
    })),
    recommendedNextActions: buildNextActions({
      llmCredentialCount,
      campaignCount,
      draftCount,
      approvedApprovals,
      packageCount,
      postizReady,
      analyticsConnected,
      totalLeads,
      ghlReady,
      smartLabsReady,
    }),
    _label: 'Social growth summary from tenant records',
  };
}

function buildNextActions(input: {
  llmCredentialCount: number;
  campaignCount: number;
  draftCount: number;
  approvedApprovals: number;
  packageCount: number;
  postizReady: boolean;
  analyticsConnected: boolean;
  totalLeads: number;
  ghlReady: boolean;
  smartLabsReady: boolean;
}) {
  const actions: { title: string; detail: string; route: string; priority: 'high' | 'medium' | 'low' }[] = [];

  if (input.llmCredentialCount === 0) {
    actions.push({ title: 'Connect AI model', detail: 'Needed before real content generation.', route: '/ai-settings', priority: 'high' });
  }
  if (input.campaignCount === 0) {
    actions.push({ title: 'Create a course-sales campaign', detail: 'Use a launch, event, lead magnet, or transformation template.', route: '/campaigns', priority: 'high' });
  }
  if (input.campaignCount > 0 && input.draftCount === 0) {
    actions.push({ title: 'Generate platform drafts', detail: 'Create Instagram, LinkedIn, and X versions from the active campaign.', route: '/campaigns', priority: 'high' });
  }
  if (input.draftCount > 0 && input.approvedApprovals === 0) {
    actions.push({ title: 'Approve strongest draft', detail: 'Human approval is required before scheduling packages.', route: '/approvals', priority: 'high' });
  }
  if (input.approvedApprovals > 0 && input.packageCount === 0) {
    actions.push({ title: 'Prepare scheduling package', detail: 'Generate the Postiz-ready payload after approval.', route: '/publishing', priority: 'medium' });
  }
  if (!input.postizReady) {
    actions.push({ title: 'Connect Postiz workspace', detail: 'Needed for visible social channels and scheduling payload readiness.', route: '/integration-credentials', priority: 'medium' });
  }
  if (!input.analyticsConnected) {
    actions.push({ title: 'Connect official analytics', detail: 'Needed before the platform can prove reach, engagement, and CTA clicks.', route: '/integration-credentials', priority: 'medium' });
  }
  if (input.totalLeads > 0 && !input.ghlReady) {
    actions.push({ title: 'Connect GoHighLevel', detail: 'Needed before qualified leads can be sent to the tenant CRM.', route: '/integration-credentials', priority: 'medium' });
  }
  if (input.totalLeads > 0 && !input.smartLabsReady) {
    actions.push({ title: 'Connect SmartLabs', detail: 'Needed before hot leads can be handed to the voice/chat agent.', route: '/smartlabs-voice', priority: 'medium' });
  }

  return actions.slice(0, 6);
}
