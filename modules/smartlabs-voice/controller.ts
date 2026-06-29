import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { resolveSessionContext, verifyToken, type JwtPayload } from '@shared/auth';
import { ForbiddenError, UnauthorizedError } from '@shared/errors';
import {
  auditSmartLabsAction,
  buildConversationPayload,
  buildTextToSpeechPayload,
  callSmartLabsAudio,
  callSmartLabsJson,
  externalFailure,
  requireAgentId,
  resolveSmartLabsConfig,
  smartLabsExecutionGate,
  smartLabsReadGate,
  summarizeSmartLabsConfig,
} from './service';

export const smartLabsVoiceRouter = Router();

function getPayload(req: Request): JwtPayload {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) throw new UnauthorizedError();
  return verifyToken(authHeader.substring(7));
}

function getSession(req: Request) {
  return resolveSessionContext(getPayload(req));
}

function requireConnectorRole(role: string): void {
  if (!['admin', 'cco', 'department_head', 'specialist', 'reviewer'].includes(role)) {
    throw new ForbiddenError('SmartLabs voice connector access requires an authorized product role');
  }
}

smartLabsVoiceRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireConnectorRole(session.role);
    const config = await resolveSmartLabsConfig(session.tenantKey);
    const readGate = smartLabsReadGate(config);
    const executionGate = smartLabsExecutionGate(config, { confirmExternalExecution: false });
    res.json({
      ...summarizeSmartLabsConfig(config),
      readAccess: readGate.allowed ? 'enabled' : 'blocked',
      readBlockers: readGate.reasons,
      executionAccess: executionGate.allowed ? 'enabled' : 'blocked',
      executionBlockers: executionGate.reasons,
      endpoints: {
        agents: '/v1/convai/agents',
        conversation: '/v1/convai/conversation',
        voices: '/v1/voices',
        textToSpeech: '/v1/text-to-speech',
      },
      safety: {
        customerOwnedCredentialRequired: true,
        rawSecretsReturned: false,
        externalExecutionRequiresFlagsAndApproval: true,
      },
      _label: 'SmartLabs voice connector status for this tenant',
    });
  } catch (err) {
    next(err);
  }
});

smartLabsVoiceRouter.post('/agents/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireConnectorRole(session.role);
    const config = await resolveSmartLabsConfig(session.tenantKey);
    const gate = smartLabsReadGate(config);
    if (!gate.allowed) {
      auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: 'smartlabs_agents_read_blocked', result: 'blocked' });
      res.status(403).json({
        status: 'blocked',
        reasons: gate.reasons,
        rawSecretsReturned: false,
        _label: 'SmartLabs agent list read is blocked until tenant credentials and read flag are configured',
      });
      return;
    }
    const result = await callSmartLabsJson({ config, path: '/v1/convai/agents' });
    auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: 'smartlabs_agents_read', result: result.ok ? 'success' : 'failed' });
    res.status(result.ok ? 200 : 502).json({
      status: result.ok ? 'ok' : 'failed',
      responseStatus: result.status,
      body: result.body,
      rawSecretsReturned: false,
      _label: result.ok ? 'SmartLabs agents returned from tenant API key' : 'SmartLabs agents request failed',
    });
  } catch (err) {
    next(err);
  }
});

smartLabsVoiceRouter.post('/voices/test', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireConnectorRole(session.role);
    const config = await resolveSmartLabsConfig(session.tenantKey);
    const gate = smartLabsReadGate(config);
    if (!gate.allowed) {
      auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: 'smartlabs_voices_read_blocked', result: 'blocked' });
      res.status(403).json({
        status: 'blocked',
        reasons: gate.reasons,
        rawSecretsReturned: false,
        _label: 'SmartLabs voices read is blocked until tenant credentials and read flag are configured',
      });
      return;
    }
    const result = await callSmartLabsJson({ config, path: '/v1/voices' });
    auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: 'smartlabs_voices_read', result: result.ok ? 'success' : 'failed' });
    res.status(result.ok ? 200 : 502).json({
      status: result.ok ? 'ok' : 'failed',
      responseStatus: result.status,
      body: result.body,
      rawSecretsReturned: false,
      _label: result.ok ? 'SmartLabs voices returned from tenant API key' : 'SmartLabs voices request failed',
    });
  } catch (err) {
    next(err);
  }
});

smartLabsVoiceRouter.post('/conversation', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireConnectorRole(session.role);
    const input = z.object({
      mode: z.enum(['preview', 'execute']).default('preview'),
      agentId: z.string().trim().min(1).max(160).optional(),
      message: z.string().trim().min(1).max(4000),
      conversationHistory: z.array(z.record(z.unknown())).max(50).default([]),
      confirmExternalExecution: z.boolean().default(false),
      approvalId: z.string().uuid().optional(),
      capabilityResolutionId: z.string().uuid().optional(),
      mcpMediationRequestId: z.string().uuid().optional(),
    }).parse(req.body);
    const config = await resolveSmartLabsConfig(session.tenantKey);
    const payload = buildConversationPayload(config, {
      agentId: input.agentId,
      message: input.message,
      conversationHistory: input.conversationHistory,
    });
    if (input.mode === 'preview' && !payload.agent_id) {
      auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: 'smartlabs_conversation_preview_requires_setup', result: 'blocked' });
      res.json({
        status: 'requires_agent_id',
        payload,
        reasons: ['SmartLabs agentId is missing. Add it in tenant integration credentials before execution.'],
        safety: {
          externalCallPerformed: false,
          rawSecretsReturned: false,
        },
        _label: 'SmartLabs handoff package prepared; tenant agentId must be configured before execution',
      });
      return;
    }
    requireAgentId(payload);
    const gate = smartLabsExecutionGate(config, input);

    if (input.mode === 'preview' || !gate.allowed) {
      auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: input.mode === 'execute' ? 'smartlabs_conversation_blocked' : 'smartlabs_conversation_preview', result: input.mode === 'execute' ? 'blocked' : 'success' });
      res.status(input.mode === 'execute' ? 403 : 200).json({
        status: input.mode === 'execute' ? 'blocked' : 'prepared',
        payload,
        reasons: gate.reasons,
        executionPolicy: gate.executionPolicy,
        safety: {
          externalCallPerformed: false,
          rawSecretsReturned: false,
        },
        _label: input.mode === 'execute'
          ? 'SmartLabs conversation execution blocked by policy'
          : 'SmartLabs conversation payload prepared; no external call performed',
      });
      return;
    }

    const result = await callSmartLabsJson({
      config,
      path: '/v1/convai/conversation',
      method: 'POST',
      body: payload,
    });
    auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: 'smartlabs_conversation_execute', result: result.ok ? 'success' : 'failed' });
    if (!result.ok) throw externalFailure('SmartLabs conversation', result);
    res.json({
      status: 'executed',
      responseStatus: result.status,
      body: result.body,
      safety: {
        externalCallPerformed: true,
        rawSecretsReturned: false,
      },
      _label: 'SmartLabs conversation executed with tenant-owned API key',
    });
  } catch (err) {
    next(err);
  }
});

smartLabsVoiceRouter.post('/text-to-speech', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const session = getSession(req);
    requireConnectorRole(session.role);
    const input = z.object({
      mode: z.enum(['preview', 'execute']).default('preview'),
      agentId: z.string().trim().min(1).max(160).optional(),
      text: z.string().trim().min(1).max(4000),
      ttsBackend: z.string().trim().min(1).max(80).optional(),
      voiceId: z.string().trim().min(1).max(160).optional(),
      confirmExternalExecution: z.boolean().default(false),
      approvalId: z.string().uuid().optional(),
      capabilityResolutionId: z.string().uuid().optional(),
      mcpMediationRequestId: z.string().uuid().optional(),
    }).parse(req.body);
    const config = await resolveSmartLabsConfig(session.tenantKey);
    const payload = buildTextToSpeechPayload(config, input);
    requireAgentId(payload);
    const gate = smartLabsExecutionGate(config, input);

    if (input.mode === 'preview' || !gate.allowed) {
      auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: input.mode === 'execute' ? 'smartlabs_tts_blocked' : 'smartlabs_tts_preview', result: input.mode === 'execute' ? 'blocked' : 'success' });
      res.status(input.mode === 'execute' ? 403 : 200).json({
        status: input.mode === 'execute' ? 'blocked' : 'prepared',
        payload,
        reasons: gate.reasons,
        executionPolicy: gate.executionPolicy,
        safety: {
          externalCallPerformed: false,
          rawSecretsReturned: false,
        },
        _label: input.mode === 'execute'
          ? 'SmartLabs text-to-speech execution blocked by policy'
          : 'SmartLabs text-to-speech payload prepared; no external call performed',
      });
      return;
    }

    const result = await callSmartLabsAudio({ config, body: payload });
    auditSmartLabsAction({ userId: session.humanUserId, tenantKey: session.tenantKey, action: 'smartlabs_tts_execute', result: result.ok ? 'success' : 'failed' });
    if (!result.ok) throw externalFailure('SmartLabs text-to-speech', result);
    res.json({
      status: 'executed',
      responseStatus: result.status,
      contentType: result.contentType,
      sizeBytes: result.sizeBytes,
      audioBase64: result.audioBase64,
      safety: {
        externalCallPerformed: true,
        rawSecretsReturned: false,
      },
      _label: 'SmartLabs text-to-speech generated audio with tenant-owned API key',
    });
  } catch (err) {
    next(err);
  }
});
