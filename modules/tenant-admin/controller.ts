import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { buildDeletionReadiness, sanitizeTenantExportValue } from './lifecycle';

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

tenantAdminRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);
    const tenantKey = payload.tenantKey || 'default';
    const [tenant, users, memberships, credentials] = await Promise.all([
      prisma.tenant.findUnique({ where: { tenant_key: tenantKey } }),
      prisma.user.findMany({ where: { tenant_key: tenantKey }, select: { id: true, role: true, is_active: true } }),
      prisma.tenantMembership.findMany({ where: { tenant_key: tenantKey }, select: { user_id: true, role: true, is_active: true } }),
      prisma.integrationCredential.findMany({ where: { tenant_key: tenantKey }, select: { id: true, provider: true, is_active: true } }),
    ]);

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
    res.json({
      tenantKey,
      status: tenant?.status || 'missing',
      supportedActions: ['suspend', 'reactivate', 'archive'],
      lifecyclePolicy: {
        suspended: 'Blocks tenant login until reactivated.',
        archived: 'Blocks tenant login and marks the workspace retired.',
        billingAutomation: 'not_implemented',
        subscriptionManagement: 'not_implemented',
        tenantExport: 'available_from_admin_api',
        tenantDeletion: 'archive_then_offline_purge_job_required',
      },
      rawSecretsReturned: false,
      _label: 'Tenant lifecycle status',
    });
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
    auditLog(
      { actor: `user:${payload.sub}`, action: 'tenant_export_generated', object_type: 'tenant', object_id: bundle.tenant.id, result: 'success' },
      `Tenant export generated for ${tenantKey}`,
    );
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="tanaghum-tenant-${tenantKey}-export.json"`);
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
  const agentRepIds = await prisma.agentRep.findMany({
    where: { user_id: { in: userIds } },
    select: { id: true },
  }).then(records => records.map(record => record.id));
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
      where: { requester_id: { in: userIds } },
      select: {
        id: true,
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
      where: {
        OR: [
          { requester_user_id: { in: userIds } },
          { approver_user_id: { in: userIds } },
          { requester_agent_rep_id: { in: agentRepIds } },
          { approver_agent_rep_id: { in: agentRepIds } },
        ],
      },
      select: {
        id: true,
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
      where: { created_by_user_id: { in: userIds } },
      select: {
        id: true,
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
      where: { created_by_user_id: { in: userIds } },
      select: {
        id: true,
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
  ]);

  return sanitizeTenantExportValue({
    schemaVersion: 'tenant-export.v1',
    generatedAt: new Date().toISOString(),
    tenant: {
      id: tenant.id,
      tenantKey: tenant.tenant_key,
      name: tenant.name,
      status: tenant.status,
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
    },
  }) as Record<string, unknown> & { tenant: { id: string } };
}

async function buildTenantDeletionReadiness(tenantKey: string) {
  const tenant = await prisma.tenant.findUnique({ where: { tenant_key: tenantKey } });
  const userIds = await prisma.user.findMany({
    where: { tenant_key: tenantKey },
    select: { id: true },
  }).then(users => users.map(user => user.id));
  const [
    activeUsers,
    activeMemberships,
    activeCredentials,
    pendingApprovals,
    pendingPackages,
  ] = await Promise.all([
    prisma.user.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.tenantMembership.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.integrationCredential.count({ where: { tenant_key: tenantKey, is_active: true } }),
    prisma.approval.count({ where: { requester_user_id: { in: userIds }, approval_status: { in: ['pending', 'escalated'] } } }),
    prisma.publishingPackage.count({ where: { created_by_user_id: { in: userIds }, package_status: { in: ['draft', 'validating', 'ready_for_future_execution'] } } }),
  ]);

  const exportGenerated = process.env.LATEST_TENANT_EXPORT_AT ? true : false;
  return {
    status: tenant?.status || 'missing',
    counts: {
      activeUsers,
      activeMemberships,
      activeCredentials,
      pendingApprovals,
      pendingPackages,
    },
    ...buildDeletionReadiness({
      tenantStatus: tenant?.status || 'missing',
      activeUsers,
      activeMemberships,
      activeCredentials,
      pendingApprovals,
      pendingPackages,
      exportGenerated,
    }),
  };
}
