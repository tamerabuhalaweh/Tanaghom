import { ForbiddenError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import {
  ALGO_EVENTS,
  type DraftScoredEvent,
  type RuleAddedEvent,
  type StaleRuleDetectedEvent,
  type SpamTacticDetectedEvent,
} from './events';
import { calculateReachScore } from './scoring-engine';
import * as repo from './repository';
import type { ScoreDraftInput, AddRuleInput, ReachReadinessScore, PlatformRuleRecord } from './types';

const PERMISSIONS: Record<string, string[]> = {
  admin: ['algo:score', 'algo:rules:read', 'algo:rules:manage'],
  cco: ['algo:score', 'algo:rules:read'],
  department_head: ['algo:score', 'algo:rules:read'],
  specialist: ['algo:score', 'algo:rules:read'],
  reviewer: ['algo:score', 'algo:rules:read'],
  viewer: ['algo:rules:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export async function scoreDraft(
  requesterRole: string,
  requesterId: string,
  input: ScoreDraftInput,
): Promise<ReachReadinessScore> {
  checkPermission(requesterRole, 'algo:score');

  const rules = await repo.getRulesByPlatform(input.platform);
  const score = calculateReachScore(input, rules);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'draft_scored',
      object_type: 'content_item',
      object_id: input.contentItemId,
      result: 'success',
    },
    `Draft scored: ${score.totalScore}/100 (${score.band}) on ${input.platform}`,
  );

  const event: DraftScoredEvent = {
    contentItemId: input.contentItemId,
    platform: input.platform,
    score: score.totalScore,
    band: score.band,
    canSchedule: score.canSchedule,
    timestamp: new Date(),
  };
  await eventBus.emit(ALGO_EVENTS.DRAFT_SCORED, event);

  for (const warning of score.staleWarnings) {
    const staleEvent: StaleRuleDetectedEvent = {
      platform: warning.platform,
      ruleType: warning.ruleType,
      daysSinceReview: warning.daysSinceReview,
      severity: warning.severity,
      timestamp: new Date(),
    };
    await eventBus.emit(ALGO_EVENTS.STALE_RULE_DETECTED, staleEvent);
  }

  for (const flag of score.spamFlags) {
    const spamEvent: SpamTacticDetectedEvent = {
      contentItemId: input.contentItemId,
      tactic: flag.tactic,
      severity: flag.severity,
      timestamp: new Date(),
    };
    await eventBus.emit(ALGO_EVENTS.SPAM_TACTIC_DETECTED, spamEvent);
  }

  return score;
}

export async function getRules(
  requesterRole: string,
  platform?: string,
): Promise<PlatformRuleRecord[]> {
  checkPermission(requesterRole, 'algo:rules:read');
  if (platform) return repo.getRulesByPlatform(platform);
  return repo.getAllRules();
}

export async function addRule(
  requesterRole: string,
  requesterId: string,
  input: AddRuleInput,
): Promise<PlatformRuleRecord> {
  checkPermission(requesterRole, 'algo:rules:manage');

  const rule = await repo.addRule(input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'rule_added',
      object_type: 'platform_rule',
      object_id: rule.id,
      result: 'success',
    },
    `Platform rule added: ${input.platform}/${input.ruleType}`,
  );

  const event: RuleAddedEvent = {
    ruleId: rule.id,
    platform: input.platform,
    ruleType: input.ruleType,
    timestamp: new Date(),
  };
  await eventBus.emit(ALGO_EVENTS.RULE_ADDED, event);

  return rule;
}

export async function markRuleReviewed(
  requesterRole: string,
  requesterId: string,
  ruleId: string,
): Promise<PlatformRuleRecord> {
  checkPermission(requesterRole, 'algo:rules:manage');

  const rule = await repo.updateRuleReview(ruleId);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'rule_reviewed',
      object_type: 'platform_rule',
      object_id: ruleId,
      result: 'success',
    },
    `Platform rule reviewed: ${rule.platform}/${rule.ruleType}`,
  );

  return rule;
}

export async function getStaleRules(
  requesterRole: string,
  platform?: string,
): Promise<PlatformRuleRecord[]> {
  checkPermission(requesterRole, 'algo:rules:read');
  return repo.getStaleRules(platform);
}
