import { afterEach, describe, expect, it } from 'vitest';
import {
  buildConversationPayload,
  buildTextToSpeechPayload,
  sanitizeSmartLabsResponse,
  smartLabsExecutionGate,
  smartLabsReadGate,
  summarizeSmartLabsConfig,
  type SmartLabsConfig,
} from './service';

const configured: SmartLabsConfig = {
  configured: true,
  source: 'tenant_vault',
  baseUrl: 'https://api.thesmartlabs.net',
  apiKey: 'tenant-owned-key',
  agentId: 'AGENT_ID',
  voiceId: 'smarttts2-xms-default',
  ttsBackend: 'omnivoice',
};

describe('SmartLabs voice connector policy and payloads', () => {
  afterEach(() => {
    delete process.env.DEMO_MODE;
    delete process.env.SMARTLABS_READ_ENABLED;
    delete process.env.SMARTLABS_LIVE_ENABLED;
    delete process.env.VOICE_CHAT_LIVE_ENABLED;
    delete process.env.EXTERNAL_EXECUTION_ENABLED;
    delete process.env.M5_WRITE_EXECUTION_ENABLED;
  });

  it('builds the SmartLabs conversation payload from the documented API shape', () => {
    expect(buildConversationPayload(configured, {
      message: 'السلام عليكم',
      conversationHistory: [],
    })).toEqual({
      agent_id: 'AGENT_ID',
      message: 'السلام عليكم',
      conversation_history: [],
    });
  });

  it('builds the SmartLabs text-to-speech payload from the documented API shape', () => {
    expect(buildTextToSpeechPayload(configured, {
      text: 'وعليكم السلام، كيف أقدر أساعدك؟',
    })).toEqual({
      agent_id: 'AGENT_ID',
      text: 'وعليكم السلام، كيف أقدر أساعدك؟',
      tts_backend: 'omnivoice',
      voice_id: 'smarttts2-xms-default',
    });
  });

  it('blocks read calls unless tenant credentials and the read flag exist', () => {
    expect(smartLabsReadGate(configured).allowed).toBe(false);

    process.env.SMARTLABS_READ_ENABLED = 'true';
    expect(smartLabsReadGate(configured).allowed).toBe(true);
    expect(smartLabsReadGate({ ...configured, configured: false, apiKey: '' }).allowed).toBe(false);
  });

  it('blocks execution unless every runtime gate and confirmation is satisfied', () => {
    expect(smartLabsExecutionGate(configured, { confirmExternalExecution: true }).allowed).toBe(false);

    process.env.SMARTLABS_LIVE_ENABLED = 'true';
    process.env.VOICE_CHAT_LIVE_ENABLED = 'true';
    process.env.EXTERNAL_EXECUTION_ENABLED = 'true';
    process.env.M5_WRITE_EXECUTION_ENABLED = 'true';
    const gate = smartLabsExecutionGate(configured, {
      confirmExternalExecution: true,
      approvalId: '00000000-0000-4000-8000-000000000001',
      capabilityResolutionId: '00000000-0000-4000-8000-000000000002',
      mcpMediationRequestId: '00000000-0000-4000-8000-000000000003',
    });

    expect(gate.allowed).toBe(true);
  });

  it('does not expose raw API keys in status summaries or sanitized responses', () => {
    expect(JSON.stringify(summarizeSmartLabsConfig(configured))).not.toContain('tenant-owned-key');

    const sanitized = sanitizeSmartLabsResponse({
      id: 'agent-1',
      apiKey: 'must-not-return',
      nested: {
        access_token: 'hidden',
        label: 'safe',
      },
    });

    expect(JSON.stringify(sanitized)).not.toContain('must-not-return');
    expect(JSON.stringify(sanitized)).not.toContain('hidden');
    expect(JSON.stringify(sanitized)).toContain('safe');
  });
});
