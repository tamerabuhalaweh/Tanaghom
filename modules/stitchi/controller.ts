import { Router, Request, Response, NextFunction } from 'express';
import { verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import * as service from './service';
import {
  actionDecisionSchema,
  createActionRunSchema,
  createConversationSchema,
  createMessageSchema,
  listConversationSchema,
  readOnlyAssistantRequestSchema,
} from './types';

export const stitchiRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function session(payload: JwtPayload) {
  return {
    role: payload.role,
    tenantKey: payload.tenantKey || 'default',
    userId: payload.sub,
  };
}

stitchiRouter.get('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = listConversationSchema.parse({
      status: req.query.status,
      eventId: req.query.eventId,
      includeTenant: req.query.includeTenant,
    });
    const conversations = await service.listConversations(context.role, context.tenantKey, context.userId, input);
    res.json(conversations);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = createConversationSchema.parse(req.body);
    const conversation = await service.createConversation(context.role, context.tenantKey, context.userId, input);
    res.status(201).json(conversation);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.get('/conversations/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const conversation = await service.getConversation(context.role, context.tenantKey, context.userId, req.params.id as string);
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/conversations/:id/archive', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const conversation = await service.archiveConversation(context.role, context.tenantKey, context.userId, req.params.id as string);
    res.json(conversation);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.get('/conversations/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const messages = await service.listMessages(context.role, context.tenantKey, context.userId, req.params.id as string);
    res.json(messages);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/conversations/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = createMessageSchema.parse(req.body);
    const message = await service.createMessage(context.role, context.tenantKey, context.userId, req.params.id as string, input);
    res.status(201).json(message);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/conversations/:id/respond', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = readOnlyAssistantRequestSchema.parse(req.body);
    const response = await service.generateReadOnlyAssistantResponse(
      context.role,
      context.tenantKey,
      context.userId,
      req.params.id as string,
      input,
    );
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/conversations/:id/respond/stream', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = readOnlyAssistantRequestSchema.parse(req.body);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    for await (const event of service.streamReadOnlyAssistantResponse(
      context.role,
      context.tenantKey,
      context.userId,
      req.params.id as string,
      input,
    )) {
      writeSse(res, `stitchi.${event.type}`, event);
    }
    res.end();
  } catch (err) {
    if (res.headersSent) {
      writeSse(res, 'stitchi.error', {
        message: err instanceof Error ? err.message : 'Stitchi response failed',
      });
      res.end();
      return;
    }
    next(err);
  }
});

stitchiRouter.post('/conversations/:id/orchestrate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = readOnlyAssistantRequestSchema.parse(req.body);
    const response = await service.orchestrateUserMessage(
      context.role,
      context.tenantKey,
      context.userId,
      req.params.id as string,
      input,
    );
    res.status(201).json(response);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.get('/conversations/:id/actions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const runs = await service.listActionRuns(context.role, context.tenantKey, context.userId, req.params.id as string);
    res.json(runs);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/conversations/:id/actions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = createActionRunSchema.parse(req.body);
    const run = await service.createActionRun(context.role, context.tenantKey, context.userId, req.params.id as string, input);
    res.status(201).json(run);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/actions/:id/approve', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = actionDecisionSchema.parse(req.body);
    const result = await service.approveActionRun(context.role, context.tenantKey, context.userId, req.params.id as string, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/actions/:id/approve-and-execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = actionDecisionSchema.parse(req.body);
    const result = await service.approveAndExecuteActionRun(context.role, context.tenantKey, context.userId, req.params.id as string, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/actions/:id/reject', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = actionDecisionSchema.parse(req.body);
    const result = await service.rejectActionRun(context.role, context.tenantKey, context.userId, req.params.id as string, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/actions/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const input = actionDecisionSchema.parse(req.body);
    const result = await service.cancelActionRun(context.role, context.tenantKey, context.userId, req.params.id as string, input);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

stitchiRouter.post('/actions/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payload = getPayload(req);
    const context = session(payload);
    const result = await service.executeApprovedActionRun(context.role, context.tenantKey, context.userId, req.params.id as string);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

function writeSse(res: Response, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}
