import { createHash } from 'crypto';
import type {
  PostizProvider,
  PostizDraftRequest,
  PostizDraftResult,
  PostizScheduleRequest,
  PostizScheduleResult,
  PostizPublishRequest,
  PostizPublishResult,
} from './postiz';

function generatePayloadHash(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(sorted).digest('hex');
}

export class MockPostizProvider implements PostizProvider {
  async createDraft(request: PostizDraftRequest): Promise<PostizDraftResult> {
    const payloadData = {
      platform: request.platform,
      content: request.content.substring(0, 100),
      accountReference: request.accountReference,
      mediaRefs: request.mediaRefs || [],
      hashtags: request.hashtags || [],
    };
    const payloadHash = generatePayloadHash(payloadData);

    return {
      success: true,
      externalReference: `mock-draft-${Date.now()}`,
      draftId: `mock-draft-id-${Date.now()}`,
      payloadHash,
      payloadSummary: `Mock draft for ${request.platform}: ${request.content.substring(0, 50)}...`,
    };
  }

  async prepareSchedule(request: PostizScheduleRequest): Promise<PostizScheduleResult> {
    const payloadData = {
      platform: request.platform,
      content: request.content.substring(0, 100),
      accountReference: request.accountReference,
      scheduledAt: request.scheduledAt.toISOString(),
      timezone: request.timezone,
    };
    const payloadHash = generatePayloadHash(payloadData);

    return {
      success: true,
      externalReference: `mock-schedule-${Date.now()}`,
      scheduledJobId: `mock-job-id-${Date.now()}`,
      payloadHash,
      payloadSummary: `Mock scheduled post for ${request.platform} at ${request.scheduledAt.toISOString()}`,
    };
  }

  async publish(_request: PostizPublishRequest): Promise<PostizPublishResult> {
    // M5 publish is blocked in mock provider
    return {
      success: false,
      error: 'M5 publishing is blocked. MockPostizProvider does not support real publishing.',
      payloadHash: 'blocked',
      payloadSummary: 'Publishing blocked by M5 gate',
    };
  }
}
