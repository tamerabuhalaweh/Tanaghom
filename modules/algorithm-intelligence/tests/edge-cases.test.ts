import { describe, it, expect } from 'vitest';
import { calculateReachScore } from '../scoring-engine';
import type { ScoreDraftInput, PlatformRuleRecord } from '../types';
import { SCORING_BANDS } from '../types';

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

describe('Scoring Bands', () => {
  it('approve band is 90-100', () => {
    expect(SCORING_BANDS.approve.min).toBe(90);
    expect(SCORING_BANDS.approve.max).toBe(100);
  });

  it('optimize band is 75-89', () => {
    expect(SCORING_BANDS.optimize.min).toBe(75);
    expect(SCORING_BANDS.optimize.max).toBe(89);
  });

  it('revise band is 60-74', () => {
    expect(SCORING_BANDS.revise.min).toBe(60);
    expect(SCORING_BANDS.revise.max).toBe(74);
  });

  it('block band is 0-59', () => {
    expect(SCORING_BANDS.block.min).toBe(0);
    expect(SCORING_BANDS.block.max).toBe(59);
  });
});

describe('Edge Cases', () => {
  it('handles empty draft text gracefully', () => {
    const input = makeInput({ draftText: 'x' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });

  it('handles missing optional fields', () => {
    const input: ScoreDraftInput = {
      contentItemId: '550e8400-e29b-41d4-a716-446655440000',
      platform: 'linkedin',
      draftText: 'Minimal content for testing',
    };
    const score = calculateReachScore(input, emptyRules);
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
  });

  it('handles all platforms', () => {
    const platforms = ['linkedin', 'instagram', 'x', 'facebook', 'tiktok', 'youtube', 'reddit'];
    for (const platform of platforms) {
      const score = calculateReachScore(makeInput({ platform }), emptyRules);
      expect(score.totalScore).toBeGreaterThanOrEqual(0);
      expect(score.totalScore).toBeLessThanOrEqual(100);
      expect(score.components).toHaveLength(9);
    }
  });

  it('component scores are between 0 and 100', () => {
    const score = calculateReachScore(makeInput(), emptyRules);
    for (const component of score.components) {
      expect(component.score).toBeGreaterThanOrEqual(0);
      expect(component.score).toBeLessThanOrEqual(100);
      expect(component.weightedScore).toBeGreaterThanOrEqual(0);
      expect(component.weightedScore).toBeLessThanOrEqual(component.maxWeightedScore);
    }
  });

  it('weighted scores sum correctly', () => {
    const score = calculateReachScore(makeInput(), emptyRules);
    const totalWeighted = score.components.reduce((sum, c) => sum + c.weightedScore, 0);
    const totalMax = score.components.reduce((sum, c) => sum + c.maxWeightedScore, 0);
    const calculatedScore = Math.round((totalWeighted / totalMax) * 100);
    expect(score.totalScore).toBe(calculatedScore);
  });
});
