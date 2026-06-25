import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError, ForbiddenError, NotFoundError } from '@shared/errors';
import { prisma } from '@shared/database';
import { auditLog } from '@shared/logging';
import { hashPassword } from '@shared/auth';
import type { Prisma, Role as PrismaRole } from '@prisma/client';

export const adminUsersRouter = Router();

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

adminUsersRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);

    const users = await prisma.user.findMany({
      include: { department: true, agent_reps: true },
      orderBy: { created_at: 'desc' },
    });

    res.json(users.map((u: Record<string, unknown>) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      department: (u.department as Record<string, unknown>)?.name || null,
      departmentId: u.department_id,
      agentRep: Array.isArray(u.agent_reps) && u.agent_reps.length > 0 ? {
        id: (u.agent_reps[0] as Record<string, unknown>).id,
        name: (u.agent_reps[0] as Record<string, unknown>).name,
        status: (u.agent_reps[0] as Record<string, unknown>).status,
        agentType: (u.agent_reps[0] as Record<string, unknown>).agent_type,
        permissionsContext: (u.agent_reps[0] as Record<string, unknown>).permissions_context,
        metadata: (u.agent_reps[0] as Record<string, unknown>).metadata,
      } : null,
      isActive: u.is_active,
      createdAt: u.created_at,
    })));
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);

    const { email, name, role, departmentId, password, businessRole, roleTemplate } = req.body;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new Error('User with this email already exists');
    }

    const passwordHash = await hashPassword(password || 'TempPassword123!');

    const user = await prisma.user.create({
      data: {
        email,
        name,
        role: role || 'specialist',
        department_id: departmentId || null,
        password_hash: passwordHash,
        is_active: true,
      },
    });
    const agentRep = await prisma.agentRep.create({
      data: {
        user_id: user.id,
        name: `${user.name} AgentRep`,
        agent_type: 'functional',
        status: 'active',
        permissions_context: {
          role: user.role,
          departmentId: user.department_id,
          businessRole: businessRole || null,
          roleTemplate: roleTemplate || null,
          source: 'admin_user_creation',
        },
        metadata: {
          businessRole: businessRole || null,
          roleTemplate: roleTemplate || null,
        },
      },
    });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'user_created', object_type: 'user', object_id: user.id, result: 'success' },
      `User created: ${email} with role ${role}`,
    );

    res.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      departmentId: user.department_id,
      agentRep: {
        id: agentRep.id,
        name: agentRep.name,
        status: agentRep.status,
        permissionsContext: agentRep.permissions_context,
        metadata: agentRep.metadata,
      },
      isActive: user.is_active,
      _label: 'User created — password must be changed on first login',
    });
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);

    const id = req.params.id as string;
    const { name, role, departmentId, isActive } = req.body;

    const user = await prisma.user.findUnique({ where: { id: id as string } });
    if (!user) throw new NotFoundError('User', id as string);

    const data: Prisma.UserUncheckedUpdateInput = {
      ...(name !== undefined && { name: name as string }),
      ...(role !== undefined && { role: role as PrismaRole }),
      ...(departmentId !== undefined && { department_id: departmentId as string | null }),
      ...(isActive !== undefined && { is_active: isActive as boolean }),
    };

    const updated = await prisma.user.update({
      where: { id: id as string },
      data,
    });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'user_updated', object_type: 'user', object_id: id as string, result: 'success' },
      `User updated: ${updated.email}`,
    );

    res.json({
      id: updated.id,
      email: updated.email,
      name: updated.name,
      role: updated.role,
      departmentId: updated.department_id,
      isActive: updated.is_active,
    });
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.post('/:id/deactivate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);

    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);

    await prisma.user.update({ where: { id }, data: { is_active: false } });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'user_deactivated', object_type: 'user', object_id: id, result: 'success' },
      `User deactivated: ${user.email}`,
    );

    res.json({ message: 'User deactivated', id });
  } catch (err) {
    next(err);
  }
});

adminUsersRouter.post('/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    requireAdmin(payload.role);

    const id = req.params.id as string;
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User', id);

    await prisma.user.update({ where: { id }, data: { is_active: true } });

    auditLog(
      { actor: `user:${payload.sub}`, action: 'user_activated', object_type: 'user', object_id: id, result: 'success' },
      `User activated: ${user.email}`,
    );

    res.json({ message: 'User activated', id });
  } catch (err) {
    next(err);
  }
});
