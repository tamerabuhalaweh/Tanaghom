import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import {
  buildDeletionReadiness,
  buildPrivacyReviewChecklist,
  canManageTenantPrivacy,
  readTenantExportEvidence,
  recordTenantExportEvidence,
  sanitizeTenantExportValue,
  TENANT_PRIVACY_REVIEW_STATUSES,
  TENANT_RETENTION_MODES,
} from './lifecycle';
import {
  DEFAULT_PRODUCTION_ENTITLEMENTS,
  DEFAULT_PRODUCTION_PLAN_KEY,
  buildSubscriptionHealth,
  sanitizeSubscriptionEventState,
} from './subscription';

export const tenantAdminRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function requireAdmin(role: string): void {
  if (role !== 'admin' && role !== 'cco') {
    throw new ForbiddenError('Admin or CCO access required');
  }
}

function requirePrivacyAdmin(role: string): void {
  if (!canManageTenantPrivacy(role)) {
    throw new ForbiddenError('Executive privacy admin access required');
  }
}

tenantAdminRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const [tenant, users, memberships, credentials, subscription] = await Promise.all([
      prisma.tenant.findUnique({ where: { tenant_key: tenantKey } }),
      prisma.user.findMany({ where: { tenant_key: tenantKey }, select: { id: true, role: true, is_active: true } }),
      prisma.tenantMembership.findMany({ where: { tenant_key: tenantKey }, select: { user_id: true, role: true, is_active: true } }),
      prisma.integrationCredential.findMany({ where: { tenant_key: tenantKey }, select: { id: true, provider: true, is_active: true } }),
      getCurrentTenantSubscription(tenantKey),
    ]);
    const subscriptionHealth = buildSubscriptionHealth({
      tenantStatus: tenant?.status || 'missing',
      subscriptionStatus: subscription?.status,
      currentPeriodEnd: subscription?.current_period_end,
      entitlements: subscription?.plan.entitlements,
      entitlementOverrides: subscription?.entitlements_override,
    });

    const roleCounts = users.reduce<Record<string, number>>((acc, user) => {
      acc[user.role] = (acc[user.role] || 0) + 1;
      return acc;
    }, {});

    res.json({
      tenant: tenant ? {
        id: tenant.id,
        tenantKey: tenant.tenant_key,
        name: tenant.name,
        status: tenant.status,
        createdAt: tenant.created_at,
        updatedAt: tenant.updated_at,
      } : {
        tenantKey,
        status: 'missing',
      },
      users: {
        total: users.length,
        active: users.filter(user => user.is_active).length,
        inactive: users.filter(user => !user.is_active).length,
        roleCounts,
      },
      memberships: {
        total: memberships.length,
        active: memberships.filter(membership => membership.is_active).length,
        inactive: memberships.filter(membership => !membership.is_active).length,
      },
      credentials: {
        total: credentials.length,
        active: credentials.filter(credential => credential.is_active).length,
        byProvider: credentials.reduce<Record<string, number>>((acc, credential) => {
          acc[credential.provider] = (acc[credential.provider] || 0) + 1;
          return acc;
        }, {}),
        rawSecretsReturned: false,
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        source: subscription.source,
        planKey: subscription.plan.plan_key,
        planName: subscription.plan.name,
        currentPeriodEnd: subscription.current_period_end,
        serviceAccess: subscriptionHealth.serviceAccess,
        blockers: subscriptionHealth.blockers,
      } : {
        status: 'missing',
        serviceAccess: false,
        blockers: subscriptionHealth.blockers,
      },
      _label: 'Tenant admin summary loaded for authenticated tenant only',
    });
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const input = z.object({
      name: z.string().trim().min(2).max(160),
    }).parse(req.body);
    const tenant = await prisma.tenant.upsert({
      where: { tenant_key: tenantKey },
      create: {
        tenant_key: tenantKey,
        name: input.name,
        status: 'active',
      },
      update: { name: input.name },
    });
    auditLog(
      { actor: `user:${payload.sub}`, action: 'tenant_updated', object_type: 'tenant', object_id: tenant.id, result: 'success' },
      `Tenant updated: ${tenant.tenant_key}`,
    );
    res.json({
      tenantKey: tenant.tenant_key,
      name: tenant.name,
      status: tenant.status,
      _label: 'Tenant updated',
    });
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.get('/isolation-report', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const [users, memberships, credentials] = await Promise.all([
      prisma.user.findMany({ where: { tenant_key: tenantKey }, select: { id: true, email: true, role: true } }),
      prisma.tenantMembership.findMany({ where: { tenant_key: tenantKey }, select: { user_id: true, role: true, is_active: true } }),
      prisma.integrationCredential.findMany({ where: { tenant_key: tenantKey }, select: { id: true, provider: true, credential_type: true, connection_key: true, is_active: true } }),
    ]);
    const membershipByUserId = new Map(memberships.map(membership => [membership.user_id, membership]));
    const missingMembershipUsers = users
      .filter(user => !membershipByUserId.has(user.id))
      .map(user => ({ id: user.id, email: user.email, role: user.role }));
    const inactiveMembershipUsers = users
      .filter(user => membershipByUserId.get(user.id)?.is_active === false)
      .map(user => ({ id: user.id, email: user.email, role: user.role }));
    const roleMismatchUsers = users
      .filter(user => {
        const membership = membershipByUserId.get(user.id);
        return membership && membership.role !== user.role;
      })
      .map(user => ({
        id: user.id,
        email: user.email,
        userRole: user.role,
        membershipRole: membershipByUserId.get(user.id)?.role,
      }));

    const findings = [
      ...missingMembershipUsers.map(user => ({ severity: 'high', type: 'missing_membership', user })),
      ...inactiveMembershipUsers.map(user => ({ severity: 'critical', type: 'inactive_membership', user })),
      ...roleMismatchUsers.map(user => ({ severity: 'medium', type: 'role_mismatch', user })),
    ];

    res.json({
      tenantKey,
      status: findings.some(finding => finding.severity === 'critical' || finding.severity === 'high') ? 'attention_required' : 'passed',
      checks: {
        usersHaveMemberships: missingMembershipUsers.length === 0,
        activeUsersHaveActiveMemberships: inactiveMembershipUsers.length === 0,
        membershipRolesMatchUserRoles: roleMismatchUsers.length === 0,
        credentialsScopedToTenant: true,
        rawSecretsReturned: false,
      },
      counts: {
        users: users.length,
        memberships: memberships.length,
        credentials: credentials.length,
        findings: findings.length,
      },
      findings,
      _label: 'Tenant isolation report generated for authenticated tenant only',
    });
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.get('/lifecycle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const tenant = await prisma.tenant.findUnique({ where: { tenant_key: tenantKey } });
    const subscription = await getCurrentTenantSubscription(tenantKey);
    const subscriptionHealth = buildSubscriptionHealth({
      tenantStatus: tenant?.status || 'missing',
      subscriptionStatus: subscription?.status,
      currentPeriodEnd: subscription?.current_period_end,
      entitlements: subscription?.plan.entitlements,
      entitlementOverrides: subscription?.entitlements_override,
    });
    res.json({
      tenantKey,
      status: tenant?.status || 'missing',
      supportedActions: ['suspend', 'reactivate', 'archive'],
      lifecyclePolicy: {
        suspended: 'Blocks tenant login until reactivated.',
        archived: 'Blocks tenant login and marks the workspace retired.',
        billingAutomation: 'manual_or_external_until_payment_provider_connected',
        subscriptionManagement: 'available_from_admin_api',
        tenantExport: 'available_from_admin_api',
        tenantDeletion: 'archive_then_offline_purge_job_required',
      },
      subscription: subscription ? {
        id: subscription.id,
        status: subscription.status,
        source: subscription.source,
        planKey: subscription.plan.plan_key,
        planName: subscription.plan.name,
        currentPeriodEnd: subscription.current_period_end,
        serviceAccess: subscriptionHealth.serviceAccess,
        blockers: subscriptionHealth.blockers,
        warnings: subscriptionHealth.warnings,
      } : {
        status: 'missing',
        serviceAccess: false,
        blockers: subscriptionHealth.blockers,
      },
      rawSecretsReturned: false,
      _label: 'Tenant lifecycle status',
    });
  } catch (err) {
    next(err);
  }
});

const tenantPrivacyPolicySchema = z.object({
  retentionMode: z.enum(TENANT_RETENTION_MODES).default('legal_review_required'),
  customRetentionDays: z.coerce.number().int().min(1).max(36500).nullable().optional(),
  storeConversationLogs: z.boolean().default(true),
  storeVoiceCallTranscripts: z.boolean().default(true),
  storeSocialDmLogs: z.boolean().default(true),
  storeCrmLeadData: z.boolean().default(true),
  exportDeleteRoles: z.array(z.enum(['admin', 'cco'])).min(1).max(2).default(['admin', 'cco']),
  legalBasisNotes: z.string().trim().max(1500).nullable().optional(),
  customerLegalOwner: z.string().trim().max(220).nullable().optional(),
  dpoOrPrivacyContact: z.string().trim().max(220).nullable().optional(),
  reviewStatus: z.enum(TENANT_PRIVACY_REVIEW_STATUSES).default('pending_customer_legal_review'),
});

async function buildPrivacyGovernanceResponse(tenantKey: string) {
  const tenant = await prisma.tenant.upsert({
    where: { tenant_key: tenantKey },
    create: {
      tenant_key: tenantKey,
      name: tenantKey === 'default' ? 'Tanaghum Default Tenant' : tenantKey,
      status: 'active',
    },
    update: {},
  });
  const review = buildPrivacyReviewChecklist(tenant.privacy_policy, tenant.privacy_review_status);
  return {
    tenantKey,
    reviewStatus: review.reviewStatus,
    automationGate: review.automationGate,
    policy: review.policy,
    checklist: review.checklist,
    explanation: review.explanation,
    allowedActors: {
      customerRoles: ['CEO', 'GM', 'CCO'],
      implementedSystemRoles: ['admin', 'cco'],
      gmRoleNote: 'A dedicated GM system role is not configured yet. Until then, GM-level export/delete authority must use an admin or CCO account.',
    },
    storedDataCategories: [
      { key: 'conversation_logs', label: 'Stitchi and agent conversation logs', enabled: review.policy.storeConversationLogs, why: 'Auditability of AI-assisted work and customer-facing agent actions.' },
      { key: 'crm_leads', label: 'CRM leads and sales outcomes', enabled: review.policy.storeCrmLeadData, why: 'Commercial reporting, follow-up, purchases, meetings, and no-show analysis.' },
      { key: 'voice_calls', label: 'Voice call transcripts or summaries', enabled: review.policy.storeVoiceCallTranscripts, why: 'Lead handling quality, sales coaching, and audit evidence.' },
      { key: 'social_dms', label: 'Social DM/comment records', enabled: review.policy.storeSocialDmLogs, why: 'Customer support, social lead qualification, and AI response review.' },
    ],
    liveAutomationPolicy: review.automationGate === 'ready'
      ? 'Live social, CRM, voice, and AI-agent workflows may be enabled when connector credentials and business approvals are also ready.'
      : 'Live social, CRM, voice, and AI-agent workflows remain gated until privacy/legal review is documented.',
    legalDisclaimer: 'Tanaghum records the customer privacy decision and readiness evidence. This is not legal advice; final UAE PDPL/data-protection acceptance must come from customer legal counsel.',
    rawSecretsReturned: false,
    _label: 'Privacy and retention governance loaded',
  };
}

tenantAdminRouter.get('/privacy-governance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requirePrivacyAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    res.json(await buildPrivacyGovernanceResponse(tenantKey));
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.put('/privacy-governance', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requirePrivacyAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const input = tenantPrivacyPolicySchema.parse(req.body);
    const { reviewStatus, ...policy } = input;
    const tenant = await prisma.tenant.upsert({
      where: { tenant_key: tenantKey },
      create: {
        tenant_key: tenantKey,
        name: tenantKey === 'default' ? 'Tanaghum Default Tenant' : tenantKey,
        status: 'active',
        privacy_policy: {
          schemaVersion: 'tenant-privacy-policy.v1',
          ...policy,
        },
        privacy_review_status: reviewStatus,
        privacy_review_updated_at: new Date(),
        privacy_review_updated_by_user_id: payload.sub,
      },
      update: {
        privacy_policy: {
          schemaVersion: 'tenant-privacy-policy.v1',
          ...policy,
        },
        privacy_review_status: reviewStatus,
        privacy_review_updated_at: new Date(),
        privacy_review_updated_by_user_id: payload.sub,
      },
    });
    auditLog(
      { actor: `user:${payload.sub}`, action: 'tenant_privacy_policy_updated', object_type: 'tenant', object_id: tenant.id, result: 'success' },
      `Tenant privacy policy updated for ${tenantKey}: ${reviewStatus}`,
    );
    res.json({
      ...await buildPrivacyGovernanceResponse(tenantKey),
      _label: 'Privacy and retention policy saved. Live automation remains gated until the checklist is ready.',
    });
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    await ensureTenantPlanCatalog();
    const plans = await prisma.tenantPlan.findMany({ orderBy: { created_at: 'asc' } });
    res.json({
      plans: plans.map(plan => ({
        id: plan.id,
        planKey: plan.plan_key,
        name: plan.name,
        description: plan.description,
        status: plan.status,
        billingInterval: plan.billing_interval,
        currency: plan.currency,
        monthlyPriceCents: plan.monthly_price_cents,
        annualPriceCents: plan.annual_price_cents,
        entitlements: plan.entitlements,
      })),
      billingCollection: 'external_or_manual_until_payment_provider_connected',
      rawSecretsReturned: false,
      _label: 'Tenant plan catalog loaded',
    });
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.get('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    await ensureTenantPlanCatalog();
    const state = await buildTenantSubscriptionResponse(tenantKey);
    res.json(state);
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.post('/subscription', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const input = z.object({
      planKey: z.string().trim().min(2).max(120).default(DEFAULT_PRODUCTION_PLAN_KEY),
      status: z.enum(['trialing', 'active', 'past_due', 'suspended', 'cancelled', 'expired']),
      source: z.enum(['manual', 'stripe', 'external_contract']).default('manual'),
      currentPeriodEnd: z.string().datetime().optional(),
      trialEndsAt: z.string().datetime().optional(),
      externalCustomerRef: z.string().trim().max(200).optional(),
      externalSubscriptionRef: z.string().trim().max(200).optional(),
      entitlementsOverride: z.record(z.unknown()).optional(),
      notes: z.string().trim().max(2000).optional(),
      reason: z.string().trim().min(5).max(1000),
    }).parse(req.body);
    await ensureTenantPlanCatalog();
    const tenant = await prisma.tenant.upsert({
      where: { tenant_key: tenantKey },
      create: {
        tenant_key: tenantKey,
        name: tenantKey === 'default' ? 'Tanaghum Default Tenant' : tenantKey,
        status: 'active',
      },
      update: {},
    });
    const plan = await prisma.tenantPlan.findUnique({ where: { plan_key: input.planKey } });
    if (!plan || plan.status !== 'active') {
      res.status(422).json({
        error: 'Selected tenant plan is not active',
        _label: 'Subscription update blocked by inactive or missing plan.',
      });
      return;
    }
    const previous = await getCurrentTenantSubscription(tenantKey);
    const subscription = await prisma.$transaction(async tx => {
      await tx.tenantSubscription.updateMany({
        where: { tenant_key: tenantKey, is_current: true },
        data: { is_current: false },
      });
      const nextSubscription = await tx.tenantSubscription.create({
        data: {
          tenant_key: tenant.tenant_key,
          plan_id: plan.id,
          status: input.status,
          source: input.source,
          is_current: true,
          current_period_start: new Date(),
          current_period_end: input.currentPeriodEnd ? new Date(input.currentPeriodEnd) : null,
          trial_ends_at: input.trialEndsAt ? new Date(input.trialEndsAt) : null,
          external_customer_ref: input.externalCustomerRef,
          external_subscription_ref: input.externalSubscriptionRef,
          entitlements_override: input.entitlementsOverride
            ? sanitizeSubscriptionEventState(input.entitlementsOverride)
            : undefined,
          notes: input.notes,
        },
      });
      await tx.tenantSubscriptionEvent.create({
        data: {
          tenant_key: tenant.tenant_key,
          subscription_id: nextSubscription.id,
          event_type: previous ? 'subscription_changed' : 'subscription_created',
          actor_user_id: payload.sub,
          reason: input.reason,
          before_state: sanitizeSubscriptionEventState(previous ? {
            id: previous.id,
            status: previous.status,
            source: previous.source,
            planKey: previous.plan.plan_key,
            currentPeriodEnd: previous.current_period_end,
          } : {}),
          after_state: sanitizeSubscriptionEventState({
            id: nextSubscription.id,
            status: nextSubscription.status,
            source: nextSubscription.source,
            planKey: plan.plan_key,
            currentPeriodEnd: nextSubscription.current_period_end,
          }),
        },
      });
      return nextSubscription;
    });
    auditLog(
      { actor: `user:${payload.sub}`, action: 'tenant_subscription_updated', object_type: 'tenant', object_id: tenant.id, result: 'success' },
      `Tenant subscription updated for ${tenantKey}: ${subscription.status}`,
    );
    res.status(201).json(await buildTenantSubscriptionResponse(tenantKey));
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.get('/export', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const bundle = await buildTenantExportBundle(tenantKey);
    const evidence = recordTenantExportEvidence(tenantKey, bundle);
    auditLog(
      { actor: `user:${payload.sub}`, action: 'tenant_export_generated', object_type: 'tenant', object_id: bundle.tenant.id, result: 'success' },
      `Tenant export generated for ${tenantKey}`,
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="tanaghum-tenant-${tenantKey}-export.json"`);
    res.setHeader('X-Tanaghum-Tenant-Export-Evidence', evidence.bundleHash);
    res.json(bundle);
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.get('/deletion-readiness', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const readiness = await buildTenantDeletionReadiness(tenantKey);
    res.json({
      tenantKey,
      ...readiness,
      rawSecretsReturned: false,
      _label: readiness.deletionReady
        ? 'Tenant is ready for a controlled offline purge job.'
        : 'Tenant is not deletion-ready. Resolve blockers before requesting a purge.',
    });
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.post('/deletion-request', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const input = z.object({
      reason: z.string().trim().min(10).max(1000),
      retentionApproved: z.boolean().default(false),
      exportReviewed: z.boolean().default(false),
    }).parse(req.body);
    const readiness = await buildTenantDeletionReadiness(tenantKey);
    const acceptedForReview = readiness.deletionReady && input.retentionApproved && input.exportReviewed;
    auditLog(
      { actor: `user:${payload.sub}`, action: 'tenant_deletion_request', object_type: 'tenant', result: acceptedForReview ? 'success' : 'blocked' },
      `Tenant deletion request for ${tenantKey}: ${input.reason}`,
    );
    res.status(acceptedForReview ? 202 : 409).json({
      tenantKey,
      acceptedForReview,
      readiness,
      requiredNextStep: acceptedForReview
        ? 'Run the separately approved offline purge job. No application UI hard-delete is available.'
        : 'Archive the tenant, generate/review export evidence, complete retention approval, and resolve blockers.',
      rawSecretsReturned: false,
      _label: acceptedForReview ? 'Tenant deletion request accepted for offline purge review.' : 'Tenant deletion request blocked by readiness policy.',
    });
  } catch (err) {
    next(err);
  }
});

tenantAdminRouter.post('/lifecycle', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const input = z.object({
      action: z.enum(['suspend', 'reactivate', 'archive']),
      reason: z.string().trim().min(3).max(500),
    }).parse(req.body);
    const nextStatus = input.action === 'reactivate' ? 'active' : input.action === 'suspend' ? 'suspended' : 'archived';
    const tenant = await prisma.tenant.upsert({
      where: { tenant_key: tenantKey },
      create: {
        tenant_key: tenantKey,
        name: tenantKey === 'default' ? 'Tanaghum Default Tenant' : tenantKey,
        status: nextStatus,
      },
      update: { status: nextStatus },
    });
    auditLog(
      { actor: `user:${payload.sub}`, action: `tenant_${input.action}`, object_type: 'tenant', object_id: tenant.id, result: 'success' },
      `Tenant lifecycle changed to ${nextStatus}: ${input.reason}`,
    );
    res.json({
      tenantKey: tenant.tenant_key,
      status: tenant.status,
      action: input.action,
      loginImpact: tenant.status === 'active' ? 'tenant users can sign in' : 'tenant users are blocked from sign-in',
      _label: 'Tenant lifecycle updated',
    });
  } catch (err) {
    next(err);
  }
});

async function buildTenantExportBundle(tenantKey: string) {
  const tenant = await prisma.tenant.upsert({
    where: { tenant_key: tenantKey },
    create: {
      tenant_key: tenantKey,
      name: tenantKey === 'default' ? 'Tanaghum Default Tenant' : tenantKey,
      status: 'active',
    },
    update: {},
  });
  const users = await prisma.user.findMany({
    where: { tenant_key: tenantKey },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      is_active: true,
      department_id: true,
      created_at: true,
      updated_at: true,
    },
    orderBy: { created_at: 'asc' },
  });
  const userIds = users.map(user => user.id);
  const [
    memberships,
    departments,
    agentReps,
    contentRequests,
    approvals,
    publishingPackages,
    leadCaptureRecords,
    llmCredentials,
    integrationCredentials,
    socialConnections,
    oauthStates,
    commercialWorkflowRuns,
    analyticsIngestionRequests,
    analyticsSnapshots,
    campaignPerformanceReports,
    tenantSubscriptions,
    tenantSubscriptionEvents,
  ] = await Promise.all([
    prisma.tenantMembership.findMany({
      where: { tenant_key: tenantKey },
      select: { id: true, user_id: true, role: true, is_active: true, created_at: true, updated_at: true },
      orderBy: { created_at: 'asc' },
    }),
    prisma.department.findMany({
      where: { users: { some: { tenant_key: tenantKey } } },
      select: { id: true, name: true, description: true, created_at: true, updated_at: true },
      orderBy: { name: 'asc' },
    }),
    prisma.agentRep.findMany({
      where: { user_id: { in: userIds } },
      select: {
        id: true,
        user_id: true,
        name: true,
        agent_type: true,
        status: true,
        permissions_context: true,
        metadata: true,
        created_at: true,
        updated_at: true,
        functional_agents: {
          select: { id: true, name: true, description: true, capability: true, status: true, config: true, created_at: true, updated_at: true },
        },
        governance_agents: {
          select: { id: true, name: true, description: true, policy_scope: true, veto_authority: true, status: true, config: true, created_at: true, updated_at: true },
        },
      },
      orderBy: { created_at: 'asc' },
    }),
    prisma.contentRequest.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        requester_id: true,
        channel: true,
        objective: true,
        audience: true,
        campaign_id: true,
        owner_department_id: true,
        content_type: true,
        risk_category: true,
        target_platforms: true,
        deadline: true,
        cta: true,
        status: true,
        created_at: true,
        updated_at: true,
        content_items: {
          select: {
            id: true,
            platform: true,
            content_type: true,
            draft_text: true,
            risk_score: true,
            risk_reason: true,
            reach_score: true,
            reach_breakdown: true,
            status: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
    prisma.approval.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        target_type: true,
        target_id: true,
        requester_user_id: true,
        requester_agent_rep_id: true,
        approver_user_id: true,
        approver_agent_rep_id: true,
        approval_type: true,
        approval_status: true,
        decision: true,
        comment: true,
        rationale: true,
        risk_category: true,
        required_department: true,
        required_role: true,
        requested_at: true,
        decided_at: true,
        expires_at: true,
        escalated_at: true,
      },
      orderBy: { requested_at: 'desc' },
      take: 500,
    }),
    prisma.publishingPackage.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        package_status: true,
        package_type: true,
        campaign_id: true,
        content_item_id: true,
        approval_id: true,
        capability_resolution_id: true,
        mcp_mediation_request_id: true,
        readiness_score: true,
        readiness_summary: true,
        blocked_reasons: true,
        created_by_user_id: true,
        created_by_agent_rep_id: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
    prisma.leadCaptureRecord.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        lead_status: true,
        lead_source: true,
        campaign_id: true,
        content_item_id: true,
        publishing_package_id: true,
        platform: true,
        source_url_placeholder: true,
        contact_reference_placeholder: true,
        lead_name_placeholder: true,
        lead_phone_placeholder: true,
        lead_email_placeholder: true,
        consent_status: true,
        created_by_user_id: true,
        created_by_agent_rep_id: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
    prisma.llmProviderCredential.findMany({
      where: { owner_user_id: { in: userIds } },
      select: { id: true, owner_user_id: true, provider: true, model: true, key_fingerprint: true, is_active: true, created_at: true, updated_at: true, last_used_at: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.integrationCredential.findMany({
      where: { tenant_key: tenantKey },
      select: { id: true, provider: true, credential_type: true, connection_key: true, display_name: true, secret_fingerprints: true, metadata: true, created_by_user_id: true, is_active: true, created_at: true, updated_at: true, last_validated_at: true },
      orderBy: { created_at: 'desc' },
    }),
    prisma.socialAccountConnection.findMany({
      where: { tenant_key: tenantKey },
      select: { id: true, platform: true, account_id: true, account_name: true, scopes: true, token_expires_at: true, status: true, connected_by_user_id: true, metadata: true, connected_at: true, updated_at: true },
      orderBy: { connected_at: 'desc' },
    }),
    prisma.oAuthConnectionState.findMany({
      where: { tenant_key: tenantKey },
      select: { id: true, platform: true, redirect_uri: true, requested_scopes: true, requester_user_id: true, expires_at: true, used_at: true, created_at: true },
      orderBy: { created_at: 'desc' },
      take: 100,
    }),
    prisma.commercialWorkflowRun.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        campaign_id: true,
        created_by_user_id: true,
        created_by_agent_rep_id: true,
        status: true,
        active_stage: true,
        readiness_score: true,
        blockers: true,
        source: true,
        metadata: true,
        started_at: true,
        updated_at: true,
        completed_at: true,
        steps: {
          select: {
            id: true,
            stage_id: true,
            step_status: true,
            summary: true,
            blocking_reason: true,
            evidence_count: true,
            metadata: true,
            started_at: true,
            completed_at: true,
            updated_at: true,
          },
        },
      },
      orderBy: { started_at: 'desc' },
      take: 500,
    }),
    prisma.analyticsIngestionRequest.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        source_id: true,
        campaign_id: true,
        content_item_id: true,
        publishing_package_id: true,
        platform: true,
        requested_by_user_id: true,
        requested_by_agent_rep_id: true,
        status: true,
        requested_at: true,
        completed_at: true,
        blocked_reason: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { requested_at: 'desc' },
      take: 500,
    }),
    prisma.analyticsSnapshot.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        source_id: true,
        ingestion_request_id: true,
        campaign_id: true,
        content_item_id: true,
        publishing_package_id: true,
        platform: true,
        metrics: true,
        normalized_metrics: true,
        confidence: true,
        source_freshness: true,
        collected_at: true,
        created_at: true,
      },
      orderBy: { collected_at: 'desc' },
      take: 500,
    }),
    prisma.campaignPerformanceReport.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        reporting_period_id: true,
        campaign_id: true,
        generated_by_user_id: true,
        generated_by_agent_rep_id: true,
        report_status: true,
        summary: true,
        top_findings: true,
        risks: true,
        recommendations: true,
        linked_learning_signal_ids: true,
        linked_saif_decision_record_id: true,
        created_at: true,
        updated_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
    prisma.tenantSubscription.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        status: true,
        source: true,
        is_current: true,
        external_customer_ref: true,
        external_subscription_ref: true,
        trial_ends_at: true,
        current_period_start: true,
        current_period_end: true,
        cancel_at: true,
        cancelled_at: true,
        entitlements_override: true,
        notes: true,
        created_at: true,
        updated_at: true,
        plan: {
          select: {
            plan_key: true,
            name: true,
            status: true,
            billing_interval: true,
            currency: true,
            entitlements: true,
          },
        },
      },
      orderBy: { created_at: 'desc' },
    }),
    prisma.tenantSubscriptionEvent.findMany({
      where: { tenant_key: tenantKey },
      select: {
        id: true,
        tenant_key: true,
        subscription_id: true,
        event_type: true,
        actor_user_id: true,
        reason: true,
        before_state: true,
        after_state: true,
        created_at: true,
      },
      orderBy: { created_at: 'desc' },
      take: 500,
    }),
  ]);

  return sanitizeTenantExportValue({
    schemaVersion: 'tenant-export.v1',
    generatedAt: new Date().toISOString(),
    tenant: {
      id: tenant.id,
      tenantKey: tenant.tenant_key,
      name: tenant.name,
      status: tenant.status,
      privacyReviewStatus: tenant.privacy_review_status,
      privacyPolicy: tenant.privacy_policy,
      privacyReviewUpdatedAt: tenant.privacy_review_updated_at,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at,
    },
    redactionPolicy: {
      passwordHashesReturned: false,
      rawSecretsReturned: false,
      encryptedSecretsReturned: false,
      oauthTokensReturned: false,
      apiKeysReturned: false,
    },
    limits: {
      contentRequests: 500,
      approvals: 500,
      publishingPackages: 500,
      leadCaptureRecords: 500,
      oauthStates: 100,
    },
    data: {
      users,
      memberships,
      departments,
      agentReps,
      contentRequests,
      approvals,
      publishingPackages,
      leadCaptureRecords,
      llmCredentials,
      integrationCredentials,
      socialConnections,
      oauthStates,
      commercialWorkflowRuns,
      analyticsIngestionRequests,
      analyticsSnapshots,
      campaignPerformanceReports,
      tenantSubscriptions,
      tenantSubscriptionEvents,
    },
    counts: {
      users: users.length,
      memberships: memberships.length,
      departments: departments.length,
      agentReps: agentReps.length,
      contentRequests: contentRequests.length,
      approvals: approvals.length,
      publishingPackages: publishingPackages.length,
      leadCaptureRecords: leadCaptureRecords.length,
      llmCredentials: llmCredentials.length,
      integrationCredentials: integrationCredentials.length,
      socialConnections: socialConnections.length,
      oauthStates: oauthStates.length,
      commercialWorkflowRuns: commercialWorkflowRuns.length,
      analyticsIngestionRequests: analyticsIngestionRequests.length,
      analyticsSnapshots: analyticsSnapshots.length,
      campaignPerformanceReports: campaignPerformanceReports.length,
      tenantSubscriptions: tenantSubscriptions.length,
      tenantSubscriptionEvents: tenantSubscriptionEvents.length,
    },
  }) as Record<string, unknown> & { tenant: { id: string } };
}

async function buildTenantDeletionReadiness(tenantKey: string) {
  const tenant = await prisma.tenant.findUnique({ where: { tenant_key: tenantKey } });
  const [
    activeUsers,
    activeMemberships,
    activeCredentials,
    activeSubscriptions,
    pendingApprovals,
    pendingPackages,
  ] = await Promise.all([
    prisma.user.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.tenantMembership.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.integrationCredential.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.tenantSubscription.count({ where: { tenant_key: tenantKey, is_current: true, status: { in: ['trialing', 'active', 'past_due'] } } }),
    prisma.approval.count({ where: { tenant_key: tenantKey, approval_status: { in: ['pending', 'escalated'] } } }),
    prisma.publishingPackage.count({ where: { tenant_key: tenantKey, package_status: { in: ['draft', 'validating', 'ready_for_future_execution'] } } }),
  ]);

  const exportEvidence = readTenantExportEvidence(tenantKey);
  const readiness = buildDeletionReadiness({
    tenantStatus: tenant?.status || 'missing',
    activeUsers,
    activeMemberships,
    activeCredentials,
    activeSubscriptions,
    pendingApprovals,
    pendingPackages,
    exportGenerated: Boolean(exportEvidence),
  });
  const privacyReview = buildPrivacyReviewChecklist(tenant?.privacy_policy, tenant?.privacy_review_status || 'pending_customer_legal_review');
  const privacyBlockers = privacyReview.reviewStatus === 'approved'
    ? []
    : ['Formal privacy/legal review must be approved before deletion review can proceed.'];
  return {
    status: tenant?.status || 'missing',
    privacyReviewStatus: privacyReview.reviewStatus,
    privacyAutomationGate: privacyReview.automationGate,
    exportEvidence: exportEvidence ? {
      generatedAt: exportEvidence.generatedAt,
      bundleHash: exportEvidence.bundleHash,
      counts: exportEvidence.counts,
    } : null,
    counts: {
      activeUsers,
      activeMemberships,
      activeCredentials,
      activeSubscriptions,
      pendingApprovals,
      pendingPackages,
    },
    ...readiness,
    deletionReady: readiness.deletionReady && privacyBlockers.length === 0,
    blockers: [...readiness.blockers, ...privacyBlockers],
  };
}

async function ensureTenantPlanCatalog() {
  await prisma.tenantPlan.upsert({
    where: { plan_key: DEFAULT_PRODUCTION_PLAN_KEY },
    create: {
      plan_key: DEFAULT_PRODUCTION_PLAN_KEY,
      name: 'Commercial/Social Production',
      description: 'Production Commercial/Social workspace with customer-owned AI and integration credentials.',
      status: 'active',
      billing_interval: 'monthly',
      currency: 'USD',
      monthly_price_cents: null,
      annual_price_cents: null,
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
    },
    update: {
      name: 'Commercial/Social Production',
      description: 'Production Commercial/Social workspace with customer-owned AI and integration credentials.',
      status: 'active',
      billing_interval: 'monthly',
      currency: 'USD',
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
    },
  });
}

async function getCurrentTenantSubscription(tenantKey: string) {
  return prisma.tenantSubscription.findFirst({
    where: { tenant_key: tenantKey, is_current: true },
    include: { plan: true },
    orderBy: { created_at: 'desc' },
  });
}

async function buildTenantSubscriptionResponse(tenantKey: string) {
  const tenant = await prisma.tenant.findUnique({ where: { tenant_key: tenantKey } });
  const subscription = await getCurrentTenantSubscription(tenantKey);
  const events = subscription
    ? await prisma.tenantSubscriptionEvent.findMany({
        where: { tenant_key: tenantKey, subscription_id: subscription.id },
        orderBy: { created_at: 'desc' },
        take: 20,
      })
    : [];
  const health = buildSubscriptionHealth({
    tenantStatus: tenant?.status || 'missing',
    subscriptionStatus: subscription?.status,
    currentPeriodEnd: subscription?.current_period_end,
    entitlements: subscription?.plan.entitlements,
    entitlementOverrides: subscription?.entitlements_override,
  });

  return {
    tenantKey,
    subscription: subscription ? {
      id: subscription.id,
      status: subscription.status,
      source: subscription.source,
      isCurrent: subscription.is_current,
      planKey: subscription.plan.plan_key,
      planName: subscription.plan.name,
      planStatus: subscription.plan.status,
      billingInterval: subscription.plan.billing_interval,
      currency: subscription.plan.currency,
      monthlyPriceCents: subscription.plan.monthly_price_cents,
      annualPriceCents: subscription.plan.annual_price_cents,
      externalCustomerRefConfigured: Boolean(subscription.external_customer_ref),
      externalSubscriptionRefConfigured: Boolean(subscription.external_subscription_ref),
      trialEndsAt: subscription.trial_ends_at,
      currentPeriodStart: subscription.current_period_start,
      currentPeriodEnd: subscription.current_period_end,
      cancelAt: subscription.cancel_at,
      cancelledAt: subscription.cancelled_at,
      notes: subscription.notes,
    } : null,
    health,
    recentEvents: events.map(event => ({
      id: event.id,
      eventType: event.event_type,
      actorUserId: event.actor_user_id,
      reason: event.reason,
      createdAt: event.created_at,
    })),
    paymentProvider: {
      status: 'not_configured',
      supportedSources: ['manual', 'external_contract', 'stripe'],
      message: 'Payment collection is not connected yet. Subscription state is production-owned internally and can reference future external billing records.',
    },
    rawSecretsReturned: false,
    _label: 'Tenant subscription status loaded',
  };
}
