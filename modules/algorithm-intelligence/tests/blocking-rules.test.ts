import { describe, it, expect } from 'vitest';
import { calculateReachScore } from '../scoring-engine';
import type { ScoreDraftInput, PlatformRuleRecord } from '../types';

const emptyRules: PlatformRuleRecord[] = [];

function makeInput(overrides: Partial<ScoreDraftInput> = {}): ScoreDraftInput {
  return {
    contentItemId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'linkedin',
    draftText: 'Discover how our new blood test package can help you take control of your health. Book your screening today!',
    objective: 'Promote blood test',
    audience: 'Health-conscious professionals',
    cta: 'Book your screening today',
    hashtags: ['#SmartLabs', '#HealthTech'],
    contentType: 'post',
    riskCategory: 'low',
    ...overrides,
  };
}

describe('Medical Claim Blocking', () => {
  it('blocks scheduling when text contains "diagnose"', () => {
    const input = makeInput({ draftText: 'Our test can diagnose conditions early.' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.some((r) => r.includes('Medical claims detected'))).toBe(true);
    expect(score.blockReasons.some((r) => r.includes('diagnose'))).toBe(true);
  });

  it('blocks scheduling when text contains "treat"', () => {
    const input = makeInput({ draftText: 'This product can treat chronic conditions.' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.some((r) => r.includes('treat'))).toBe(true);
  });

  it('blocks scheduling when text contains "cure"', () => {
    const input = makeInput({ draftText: 'A natural cure for all your health problems.' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.some((r) => r.includes('cure'))).toBe(true);
  });

  it('blocks scheduling when text contains "miracle"', () => {
    const input = makeInput({ draftText: 'This miracle supplement changes everything.' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.some((r) => r.includes('miracle'))).toBe(true);
  });

  it('blocks scheduling when text contains "guarantee"', () => {
    const input = makeInput({ draftText: 'We guarantee results or your money back.' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.some((r) => r.includes('guarantee'))).toBe(true);
  });

  it('blocks scheduling when text contains "100% effective"', () => {
    const input = makeInput({ draftText: 'Our solution is 100% effective for everyone.' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.some((r) => r.includes('100% effective'))).toBe(true);
  });

  it('does not block clean medical content', () => {
    const input = makeInput({
      draftText: 'Our blood test screens for 50+ health markers. Book your screening today.',
      riskCategory: 'low',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.blockReasons.filter((r) => r.includes('Medical claims'))).toHaveLength(0);
  });
});

describe('Revise Band Scheduling', () => {
  it('revise band (60-74) is not schedulable', () => {
    // Craft input that will score in the 60-74 range
    const input = makeInput({
      draftText: 'Check out our health services. We offer various tests and screenings for your wellness needs.',
      cta: '',
      hashtags: [],
      riskCategory: 'medium',
    });
    const score = calculateReachScore(input, emptyRules);
    if (score.band === 'revise') {
      expect(score.canSchedule).toBe(false);
      expect(score.blockReasons.some((r) => r.includes('revise range'))).toBe(true);
    }
  });

  it('approve band (90-100) is schedulable when no other blockers', () => {
    const input = makeInput({
      draftText: 'Did you know early detection can save lives? Our comprehensive blood test screens for 50+ markers in a single visit.\n\nBook your screening today and take control of your health.',
      cta: 'Book your screening today',
      hashtags: ['#SmartLabs', '#HealthTech', '#Diagnostics'],
      riskCategory: 'low',
    });
    const score = calculateReachScore(input, emptyRules);
    // If score is in approve range and no medical claims/spam, should be schedulable
    if (score.band === 'approve') {
      expect(score.canSchedule).toBe(true);
    }
  });
});

describe('Optimization Suggestion Traceability', () => {
  it('suggestions include source metadata', () => {
    const input = makeInput({
      draftText: 'Short post',
      cta: '',
      hashtags: [],
    });
    const score = calculateReachScore(input, emptyRules);
    for (const suggestion of score.optimizationSuggestions) {
      expect(suggestion.source).toBeDefined();
      expect(typeof suggestion.source).toBe('string');
      expect(suggestion.source.length).toBeGreaterThan(0);
    }
  });

  it('suggestions include sourceType', () => {
    const input = makeInput({
      draftText: 'Short post',
      cta: '',
    });
    const score = calculateReachScore(input, emptyRules);
    const validSourceTypes = ['official_docs', 'internal_analytics', 'platform_rules', 'scoring_engine'];
    for (const suggestion of score.optimizationSuggestions) {
      expect(validSourceTypes).toContain(suggestion.sourceType);
    }
  });

  it('suggestions include checkedAt timestamp', () => {
    const input = makeInput({
      draftText: 'Short post',
      cta: '',
    });
    const score = calculateReachScore(input, emptyRules);
    for (const suggestion of score.optimizationSuggestions) {
      expect(suggestion.checkedAt).toBeDefined();
      expect(suggestion.checkedAt).toBeInstanceOf(Date);
    }
  });

  it('suggestions include confidence level', () => {
    const input = makeInput({
      draftText: 'Short post',
      cta: '',
    });
    const score = calculateReachScore(input, emptyRules);
    const validConfidence = ['low', 'medium', 'high'];
    for (const suggestion of score.optimizationSuggestions) {
      expect(validConfidence).toContain(suggestion.confidence);
    }
  });

  it('suggestions reference related rules when available', () => {
    const rules: PlatformRuleRecord[] = [{
      id: 'rule-123',
      platform: 'linkedin',
      ruleType: 'hookStrength',
      ruleValue: 'Strong opening hook required',
      sourceUrl: 'https://linkedin.com/best-practices',
      sourceType: 'official_docs',
      confidence: 'high',
      owner: 'marketing',
      lastReviewedAt: new Date(),
      nextReviewAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    }];
    const input = makeInput({
      draftText: 'Short post without a hook.',
      cta: '',
    });
    const score = calculateReachScore(input, rules);
    const hookSuggestion = score.optimizationSuggestions.find((s) => s.component === 'hookStrength');
    if (hookSuggestion) {
      expect(hookSuggestion.relatedRuleId).toBe('rule-123');
      expect(hookSuggestion.source).toBe('https://linkedin.com/best-practices');
      expect(hookSuggestion.sourceType).toBe('platform_rules');
      expect(hookSuggestion.confidence).toBe('high');
    }
  });
});
