export const DRAFT_EVENTS = {
  DRAFT_GENERATED: 'draft.generated',
  DRAFT_REVISED: 'draft.revised',
  DRAFT_GENERATION_FAILED: 'draft.generation_failed',
} as const;

export interface DraftGeneratedEvent {
  contentItemId: string;
  campaignRequestId: string;
  platform: string;
  versionNo: number;
  timestamp: Date;
}

export interface DraftRevisedEvent {
  contentItemId: string;
  versionNo: number;
  feedback: string;
  timestamp: Date;
}

export interface DraftGenerationFailedEvent {
  campaignRequestId: string;
  platform: string;
  error: string;
  timestamp: Date;
}
