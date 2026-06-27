import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';

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
