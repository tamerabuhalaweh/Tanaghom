import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  listUsers,
  getUser,
  createUser,
  updateUser,
  listDepartments,
  getDepartment,
  createDepartment,
  updateDepartment,
  listAgentReps,
  getAgentRepById,
  getAgentRepByUserId,
  createAgentRep,
  createOwnAgentRep,
  updateAgentRep,
  listFunctionalAgents,
  createFunctionalAgent,
  listGovernanceAgents,
  createGovernanceAgent,
} from './service';
import {
  validateCreateUser,
  validateUpdateUser,
  validateCreateDepartment,
  validateUpdateDepartment,
  validateCreateAgentRep,
  validateUpdateAgentRep,
  validateCreateFunctionalAgent,
  validateCreateGovernanceAgent,
} from './validators';
import type { CreateAgentRepInput, CreateGovernanceAgentInput } from './types';

export const usersDepartmentsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

// Users
usersDepartmentsRouter.get('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const users = await listUsers(payload.role, req.query.departmentId as string | undefined, req.query.role as string | undefined);
    res.json(users);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.get('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const user = await getUser(payload.role, req.params.id as string);
    res.json(user);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.post('/users', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateUser(req.body);
    const user = await createUser(payload.role, input);
    res.status(201).json(user);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.put('/users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateUpdateUser(req.body);
    const user = await updateUser(payload.role, req.params.id as string, input);
    res.json(user);
  } catch (err) { next(err); }
});

// Departments
usersDepartmentsRouter.get('/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const departments = await listDepartments(payload.role);
    res.json(departments);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.get('/departments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const dept = await getDepartment(payload.role, req.params.id as string);
    res.json(dept);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.post('/departments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateDepartment(req.body);
    const dept = await createDepartment(payload.role, input);
    res.status(201).json(dept);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.put('/departments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateUpdateDepartment(req.body);
    const dept = await updateDepartment(payload.role, req.params.id as string, input);
    res.json(dept);
  } catch (err) { next(err); }
});

// AgentRep
usersDepartmentsRouter.get('/agent-reps/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const agentRep = await getAgentRepByUserId(payload.role, payload.sub);
    res.json(agentRep);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.post('/agent-reps/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const agentRep = await createOwnAgentRep(payload.sub, payload.role, payload.departmentId ?? null);
    res.status(201).json({
      ...agentRep,
      _label: 'Own AgentRep is ready for this user session',
    });
  } catch (err) { next(err); }
});

usersDepartmentsRouter.get('/agent-reps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    if (req.query.userId) {
      const agentRep = await getAgentRepByUserId(payload.role, req.query.userId as string);
      res.json(agentRep);
      return;
    }
    const agentReps = await listAgentReps(payload.role);
    res.json(agentReps);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.get('/agent-reps/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const agentRep = await getAgentRepById(payload.role, req.params.id as string);
    res.json(agentRep);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.post('/agent-reps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateAgentRep({ ...req.body, agentType: req.body.agentType ?? 'functional' }) as CreateAgentRepInput;
    const agentRep = await createAgentRep(payload.role, input);
    res.status(201).json({
      ...agentRep,
      _label: 'AgentRep created - identity and session lock source of truth',
    });
  } catch (err) { next(err); }
});

usersDepartmentsRouter.put('/agent-reps/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateUpdateAgentRep(req.body);
    const agentRep = await updateAgentRep(payload.role, req.params.id as string, input);
    res.json(agentRep);
  } catch (err) { next(err); }
});

// Agent skills
usersDepartmentsRouter.get('/agent-reps/:id/functional-agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const agents = await listFunctionalAgents(payload.role, req.params.id as string);
    res.json(agents);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.post('/agent-reps/:id/functional-agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateFunctionalAgent({ ...req.body, agentRepId: req.params.id });
    const agent = await createFunctionalAgent(payload.role, input);
    res.status(201).json({
      ...agent,
      _label: 'Functional agent skill registered - execution remains governed by STITCH capability and SAIF gates',
    });
  } catch (err) { next(err); }
});

usersDepartmentsRouter.get('/agent-reps/:id/governance-agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const agents = await listGovernanceAgents(payload.role, req.params.id as string);
    res.json(agents);
  } catch (err) { next(err); }
});

usersDepartmentsRouter.post('/agent-reps/:id/governance-agents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = validateCreateGovernanceAgent({
      ...req.body,
      agentRepId: req.params.id,
      vetoAuthority: req.body.vetoAuthority ?? false,
    }) as CreateGovernanceAgentInput;
    const agent = await createGovernanceAgent(payload.role, input);
    res.status(201).json({
      ...agent,
      _label: 'Governance agent registered - evaluator/governance role, not autonomous authority',
    });
  } catch (err) { next(err); }
});
