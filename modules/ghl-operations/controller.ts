import { Router, type NextFunction, type Request, type Response } from 'express';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { UnauthorizedError } from '@shared/errors';
import {
  decideGhlOperationSchema,
  executeGhlOperationSchema,
  listGhlOperationsSchema,
  prepareGhlOperationSchema,
  reconcileGhlOperationSchema,
  submitGhlOperationSchema,
} from './types';
import { assertValidGhlWebhookSignature, assertValidLegacyGhlWebhookSignature } from './signature';
import * as service from './service';

export const ghlOperationsRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function session(req: Request) {
  return resolveSessionContext(getPayload(req));
}

ghlOperationsRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = listGhlOperationsSchema.parse(req.query);
    res.json(await service.list(session(req), input));
  } catch (error) {
    next(error);
  }
});

ghlOperationsRouter.get(
  '/reference-data',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await service.referenceData(session(req)));
    } catch (error) {
      next(error);
    }
  },
);

ghlOperationsRouter.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await service.get(session(req), req.params.id as string));
  } catch (error) {
    next(error);
  }
});

ghlOperationsRouter.post('/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = prepareGhlOperationSchema.parse(req.body);
    res.status(201).json(await service.prepare(session(req), input));
  } catch (error) {
    next(error);
  }
});

ghlOperationsRouter.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const input = submitGhlOperationSchema.parse(req.body);
    res.json(await service.submit(session(req), req.params.id as string, input));
  } catch (error) {
    next(error);
  }
});

ghlOperationsRouter.post(
  '/:id/decision',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = decideGhlOperationSchema.parse(req.body);
      res.json(await service.decide(session(req), req.params.id as string, input));
    } catch (error) {
      next(error);
    }
  },
);

ghlOperationsRouter.post(
  '/:id/execute',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = executeGhlOperationSchema.parse(req.body);
      res.json(await service.execute(session(req), req.params.id as string, input));
    } catch (error) {
      next(error);
    }
  },
);

ghlOperationsRouter.post(
  '/:id/reconcile',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = reconcileGhlOperationSchema.parse(req.body);
      res.json(await service.reconcile(session(req), req.params.id as string, input));
    } catch (error) {
      next(error);
    }
  },
);

ghlOperationsRouter.post(
  '/webhooks/:tenantKey',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signature = req.header('X-GHL-Signature');
      const legacySignature = req.header('X-WH-Signature');
      if (!signature && !legacySignature) {
        throw new UnauthorizedError('Missing GoHighLevel webhook signature');
      }
      if (!req.rawBody) throw new UnauthorizedError('Webhook raw body is unavailable');
      if (signature) {
        assertValidGhlWebhookSignature(req.rawBody, signature);
      } else {
        assertValidLegacyGhlWebhookSignature(req.rawBody, legacySignature!);
      }
      const result = await service.processWebhook({
        tenantKey: req.params.tenantKey as string,
        rawBody: req.rawBody,
      });
      res.status(200).json({
        accepted: true,
        duplicate: result.duplicate,
        reconciledOperationId: result.operation?.id ?? null,
        rawPayloadReturned: false,
      });
    } catch (error) {
      next(error);
    }
  },
);
