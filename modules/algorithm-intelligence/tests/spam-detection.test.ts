import { describe, it, expect } from 'vitest';
import { calculateReachScore } from '../scoring-engine';
import type { ScoreDraftInput, PlatformRuleRecord } from '../types';

const emptyRules: PlatformRuleRecord[] = [];

function makeInput(overrides: Partial<ScoreDraftInput> = {}): ScoreDraftInput {
  return {
    contentItemId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'linkedin',
    draftText: 'Discover how our new blood test package can help you take control of your health. Book today!',
    objective: 'Promote blood test',
    audience: 'Health-conscious professionals',
    cta: 'Book today',
    hashtags: ['#SmartLabs', '#HealthTech'],
    contentType: 'post',
    riskCategory: 'low',
    ...overrides,
  };
}

describe('Spam/Black-hat Detection', () => {
  it('detects engagement bait', () => {
    const input = makeInput({
      draftText: 'Like and share this post! Tag a friend who needs this!',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.spamFlags.length).toBeGreaterThan(0);
    expect(score.spamFlags.some((f) => f.tactic === 'engagement_bait')).toBe(true);
    expect(score.canSchedule).toBe(false);
  });

  it('detects misleading claims', () => {
    const input = makeInput({
      draftText: 'Doctors hate this one weird trick! Secret revealed!',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.spamFlags.some((f) => f.tactic === 'misleading_claims')).toBe(true);
    expect(score.canSchedule).toBe(false);
  });

  it('detects hashtag stuffing', () => {
    const input = makeInput({
      hashtags: ['#love', '#instagood', '#follow', '#like', '#photooftheday'],
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.spamFlags.some((f) => f.tactic === 'hashtag_stuffing')).toBe(true);
  });

  it('detects fake urgency', () => {
    const input = makeInput({
      draftText: 'Only 1 left! Act now or miss out! Limited spots remaining!',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.spamFlags.some((f) => f.tactic === 'fake_urgency')).toBe(true);
  });

  it('detects excessive hashtags', () => {
    const input = makeInput({
      hashtags: Array.from({ length: 20 }, (_, i) => `#tag${i}`),
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.spamFlags.some((f) => f.tactic === 'hashtag_stuffing')).toBe(true);
    expect(score.canSchedule).toBe(false);
  });

  it('clean content has no spam flags', () => {
    const input = makeInput({
      draftText: 'Our comprehensive blood test screens for 50+ markers. Book your screening today.',
      hashtags: ['#SmartLabs', '#HealthTech', '#Diagnostics'],
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.spamFlags).toHaveLength(0);
  });
});

describe('Stale Rule Detection', () => {
  it('detects never-reviewed rules', () => {
    const rules: PlatformRuleRecord[] = [{
      id: '1',
      platform: 'linkedin',
      ruleType: 'length',
      ruleValue: '1300 chars max',
      sourceUrl: null,
      sourceType: 'official_docs',
      confidence: 'high',
      owner: 'admin',
      lastReviewedAt: null,
      nextReviewAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
    const score = calculateReachScore(makeInput(), rules);
    expect(score.staleWarnings.length).toBeGreaterThan(0);
    expect(score.staleWarnings[0].severity).toBe('block');
    expect(score.canSchedule).toBe(false);
  });

  it('detects expired rules (>90 days)', () => {
    const rules: PlatformRuleRecord[] = [{
      id: '1',
      platform: 'linkedin',
      ruleType: 'length',
      ruleValue: '1300 chars max',
      sourceUrl: null,
      sourceType: 'official_docs',
      confidence: 'high',
      owner: 'admin',
      lastReviewedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
    const score = calculateReachScore(makeInput(), rules);
    expect(score.staleWarnings.length).toBeGreaterThan(0);
    expect(score.staleWarnings[0].severity).toBe('block');
  });

  it('detects aging rules (>30 days)', () => {
    const rules: PlatformRuleRecord[] = [{
      id: '1',
      platform: 'linkedin',
      ruleType: 'length',
      ruleValue: '1300 chars max',
      sourceUrl: null,
      sourceType: 'official_docs',
      confidence: 'high',
      owner: 'admin',
      lastReviewedAt: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000),
      nextReviewAt: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
    const score = calculateReachScore(makeInput(), rules);
    expect(score.staleWarnings.length).toBeGreaterThan(0);
    expect(score.staleWarnings[0].severity).toBe('warning');
  });

  it('fresh rules have no warnings', () => {
    const rules: PlatformRuleRecord[] = [{
      id: '1',
      platform: 'linkedin',
      ruleType: 'length',
      ruleValue: '1300 chars max',
      sourceUrl: null,
      sourceType: 'official_docs',
      confidence: 'high',
      owner: 'admin',
      lastReviewedAt: new Date(),
      nextReviewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
    const score = calculateReachScore(makeInput(), rules);
    expect(score.staleWarnings).toHaveLength(0);
  });
});

describe('Optimization Suggestions', () => {
  it('generates suggestions for low-scoring components', () => {
    const input = makeInput({
      draftText: 'buy now',
      cta: '',
      hashtags: [],
      riskCategory: 'high',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.optimizationSuggestions.length).toBeGreaterThan(0);
  });

  it('high-quality content has fewer suggestions', () => {
    const input = makeInput({
      draftText: 'Did you know early detection can save lives? Our comprehensive blood test screens for 50+ markers in a single visit.\n\nBook your screening today and take control of your health.',
      cta: 'Book your screening today',
      hashtags: ['#SmartLabs', '#HealthTech', '#Diagnostics'],
      riskCategory: 'low',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.optimizationSuggestions.length).toBeLessThanOrEqual(3);
  });

  it('suggestions have priority levels', () => {
    const input = makeInput({
      draftText: 'Short post',
      cta: '',
    });
    const score = calculateReachScore(input, emptyRules);
    for (const suggestion of score.optimizationSuggestions) {
      expect(['high', 'medium', 'low']).toContain(suggestion.priority);
    }
  });
});

describe('Compliance Guardrails', () => {
  it('compliance always overrides reach', () => {
    const input = makeInput({
      draftText: 'Our miracle cure can diagnose and treat any condition. 100% effective guaranteed! Doctors hate this!',
      riskCategory: 'high',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.length).toBeGreaterThan(0);
  });

  it('medical claims reduce compliance score', () => {
    const clean = calculateReachScore(makeInput({
      draftText: 'Our blood test screens for 50+ health markers.',
      riskCategory: 'low',
    }), emptyRules);
    const medical = calculateReachScore(makeInput({
      draftText: 'Our blood test can diagnose and cure any condition.',
      riskCategory: 'low',
    }), emptyRules);
    const cleanCompliance = clean.components.find((c) => c.component === 'complianceRisk');
    const medicalCompliance = medical.components.find((c) => c.component === 'complianceRisk');
    expect(cleanCompliance!.score).toBeGreaterThan(medicalCompliance!.score);
  });
});
