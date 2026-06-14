import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import { listUsers, getUser, createUser, updateUser, listDepartments, getDepartment, createDepartment, updateDepartment } from './service';
import { validateCreateUser, validateUpdateUser, validateCreateDepartment, validateUpdateDepartment } from './validators';

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
