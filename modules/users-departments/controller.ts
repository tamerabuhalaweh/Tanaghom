import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
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

usersDepartmentsRouter.post('/agent-reps/:id/import-github-skill', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const input = z.object({
      repositoryUrl: z.string().url(),
      skillPath: z.string().min(1).max(300).default('SKILL.md'),
      capability: z.string().min(1).max(200).default('imported_github_skill'),
    }).parse(req.body);
    const rawUrl = toRawGitHubUrl(input.repositoryUrl, input.skillPath);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(rawUrl, { signal: controller.signal });
      if (!response.ok) {
        res.status(400).json({ error: `GitHub skill file could not be fetched (${response.status})` });
        return;
      }
      const content = await response.text();
      const metadata = extractSkillMetadata(content);
      const agent = await createFunctionalAgent(payload.role, {
        agentRepId: req.params.id as string,
        name: metadata.name,
        description: metadata.description,
        capability: input.capability,
        config: {
          source: 'github_skill_import',
          repositoryUrl: input.repositoryUrl,
          rawUrl,
          skillPath: input.skillPath,
          executionAllowed: false,
          importedAt: new Date().toISOString(),
        },
      });
      res.status(201).json({
        ...agent,
        rawCodeExecuted: false,
        _label: 'GitHub skill metadata imported - repository code was not executed',
      });
    } finally {
      clearTimeout(timer);
    }
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

function toRawGitHubUrl(repositoryUrl: string, skillPath: string): string {
  const url = new URL(repositoryUrl);
  const normalizedPath = skillPath.replace(/^\/+/, '');
  if (url.hostname === 'raw.githubusercontent.com') {
    return repositoryUrl;
  }
  if (url.hostname !== 'github.com') {
    throw new Error('Only github.com or raw.githubusercontent.com skill imports are allowed');
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts.length < 2) throw new Error('GitHub URL must include owner and repository');
  const [owner, repo] = parts;
  const branchIndex = parts.findIndex(part => part === 'tree' || part === 'blob');
  const branch = branchIndex >= 0 && parts[branchIndex + 1] ? parts[branchIndex + 1] : 'main';
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${normalizedPath}`;
}

function extractSkillMetadata(content: string): { name: string; description: string } {
  const lines = content.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const heading = lines.find(line => line.startsWith('# '))?.replace(/^#\s+/, '').trim();
  const description = lines.find(line => !line.startsWith('#') && line.length > 12)?.slice(0, 1000);
  return {
    name: heading || 'Imported GitHub Skill',
    description: description || 'Imported from GitHub skill repository. Execution remains blocked until reviewed and governed.',
  };
}
