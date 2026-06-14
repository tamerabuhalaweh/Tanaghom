// Events for Algorithm Intelligence module

export const ALGO_EVENTS = {
  DRAFT_SCORED: 'algo.draft_scored',
  RULE_ADDED: 'algo.rule_added',
  RULE_UPDATED: 'algo.rule_updated',
  STALE_RULE_DETECTED: 'algo.stale_rule_detected',
  SPAM_TACTIC_DETECTED: 'algo.spam_tactic_detected',
} as const;

export interface DraftScoredEvent {
  contentItemId: string;
  platform: string;
  score: number;
  band: string;
  canSchedule: boolean;
  timestamp: Date;
}

export interface RuleAddedEvent {
  ruleId: string;
  platform: string;
  ruleType: string;
  timestamp: Date;
}

export interface StaleRuleDetectedEvent {
  platform: string;
  ruleType: string;
  daysSinceReview: number;
  severity: string;
  timestamp: Date;
}

export interface SpamTacticDetectedEvent {
  contentItemId: string;
  tactic: string;
  severity: string;
  timestamp: Date;
}
