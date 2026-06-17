export interface PostizDraftRequest {
  platform: string;
  content: string;
  accountReference: string;
  mediaRefs?: string[];
  hashtags?: string[];
  scheduledAt?: Date;
}

export interface PostizDraftResult {
  success: boolean;
  externalReference?: string;
  draftId?: string;
  error?: string;
  payloadHash: string;
  payloadSummary: string;
}

export interface PostizScheduleRequest {
  platform: string;
  content: string;
  accountReference: string;
  scheduledAt: Date;
  timezone: string;
  mediaRefs?: string[];
}

export interface PostizScheduleResult {
  success: boolean;
  externalReference?: string;
  scheduledJobId?: string;
  error?: string;
  payloadHash: string;
  payloadSummary: string;
}

export interface PostizPublishRequest {
  platform: string;
  content: string;
  accountReference: string;
  mediaRefs?: string[];
}

export interface PostizPublishResult {
  success: boolean;
  externalReference?: string;
  publishedPostId?: string;
  error?: string;
  payloadHash: string;
  payloadSummary: string;
}

export interface PostizProvider {
  createDraft(request: PostizDraftRequest): Promise<PostizDraftResult>;
  prepareSchedule(request: PostizScheduleRequest): Promise<PostizScheduleResult>;
  publish(request: PostizPublishRequest): Promise<PostizPublishResult>;
}
