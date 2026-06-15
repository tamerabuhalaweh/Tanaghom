import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import type { PlatformRuleRecord, AddRuleInput } from './types';

export async function getRulesByPlatform(platform: string): Promise<PlatformRuleRecord[]> {
  const rules = await prisma.platformRule.findMany({
    where: { platform },
    orderBy: { updated_at: 'desc' },
  });
  return rules.map(mapRule);
}

export async function getAllRules(): Promise<PlatformRuleRecord[]> {
  const rules = await prisma.platformRule.findMany({
    orderBy: [{ platform: 'asc' }, { rule_type: 'asc' }],
  });
  return rules.map(mapRule);
}

export async function addRule(input: AddRuleInput): Promise<PlatformRuleRecord> {
  const rule = await prisma.platformRule.create({
    data: {
      platform: input.platform,
      rule_type: input.ruleType,
      rule_value: input.ruleValue,
      source_url: input.sourceUrl,
      source_type: input.sourceType || 'official_docs',
      confidence: input.confidence || 'medium',
      owner: input.owner,
      last_reviewed_at: new Date(),
      next_review_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return mapRule(rule);
}

export async function updateRuleReview(id: string): Promise<PlatformRuleRecord> {
  const existing = await prisma.platformRule.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError('Platform rule', id);

  const rule = await prisma.platformRule.update({
    where: { id },
    data: {
      last_reviewed_at: new Date(),
      next_review_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });
  return mapRule(rule);
}

export async function getStaleRules(platform?: string): Promise<PlatformRuleRecord[]> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const where: Record<string, unknown> = {
    OR: [
      { last_reviewed_at: null },
      { last_reviewed_at: { lt: thirtyDaysAgo } },
    ],
  };
  if (platform) where.platform = platform;

  const rules = await prisma.platformRule.findMany({ where });
  return rules.map(mapRule);
}

function mapRule(r: Record<string, unknown>): PlatformRuleRecord {
  return {
    id: r.id as string,
    platform: r.platform as string,
    ruleType: r.rule_type as string,
    ruleValue: r.rule_value as string,
    sourceUrl: r.source_url as string | null,
    sourceType: r.source_type as string,
    confidence: r.confidence as string,
    owner: r.owner as string | null,
    lastReviewedAt: r.last_reviewed_at as Date | null,
    nextReviewAt: r.next_review_at as Date | null,
    createdAt: r.created_at as Date,
    updatedAt: r.updated_at as Date,
  };
}
