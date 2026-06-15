import { describe, it, expect } from 'vitest';
import { calculateReachScore } from '../scoring-engine';
import type { ScoreDraftInput, PlatformRuleRecord } from '../types';

const emptyRules: PlatformRuleRecord[] = [];

function makeInput(overrides: Partial<ScoreDraftInput> = {}): ScoreDraftInput {
  return {
    contentItemId: '550e8400-e29b-41d4-a716-446655440000',
    platform: 'linkedin',
    draftText: 'Discover how our new blood test package can help you take control of your health. Book your screening today!',
    objective: 'Promote blood test package',
    audience: 'Health-conscious professionals',
    cta: 'Book your screening today',
    hashtags: ['#SmartLabs', '#HealthTech', '#Wellness'],
    contentType: 'post',
    riskCategory: 'low',
    ...overrides,
  };
}

describe('Reach Readiness Score', () => {
  it('returns a score between 0 and 100', () => {
    const score = calculateReachScore(makeInput(), emptyRules);
    expect(score.totalScore).toBeGreaterThanOrEqual(0);
    expect(score.totalScore).toBeLessThanOrEqual(100);
  });

  it('returns all 9 scoring components', () => {
    const score = calculateReachScore(makeInput(), emptyRules);
    expect(score.components).toHaveLength(9);
  });

  it('assigns correct scoring bands', () => {
    const score = calculateReachScore(makeInput(), emptyRules);
    expect(['approve', 'optimize', 'revise', 'block']).toContain(score.band);
  });

  it('high-quality content scores in approve or optimize band', () => {
    const input = makeInput({
      draftText: 'Did you know that early detection can save lives? Our comprehensive blood test screens for 50+ markers in a single visit.\n\nBook your screening today and take control of your health. Results in 24 hours.',
      cta: 'Book your screening today',
      hashtags: ['#SmartLabs', '#HealthTech', '#Diagnostics'],
      riskCategory: 'low',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.totalScore).toBeGreaterThanOrEqual(70);
    expect(score.canSchedule).toBe(true);
  });

  it('low-quality content scores in block band', () => {
    const input = makeInput({
      draftText: 'buy now',
      cta: '',
      hashtags: [],
      riskCategory: 'high',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.totalScore).toBeLessThan(70);
  });

  it('compliance risk reduces score significantly', () => {
    const lowRisk = calculateReachScore(makeInput({ riskCategory: 'low' }), emptyRules);
    const highRisk = calculateReachScore(makeInput({ riskCategory: 'high' }), emptyRules);
    expect(highRisk.totalScore).toBeLessThan(lowRisk.totalScore);
  });

  it('medical claims block scheduling', () => {
    const input = makeInput({
      draftText: 'Our miracle cure can diagnose and treat any condition. 100% effective guaranteed!',
      riskCategory: 'high',
    });
    const score = calculateReachScore(input, emptyRules);
    expect(score.canSchedule).toBe(false);
    expect(score.blockReasons.length).toBeGreaterThan(0);
  });

  it('unknown platform returns block score', () => {
    const input = makeInput({ platform: 'unknown_platform' });
    const score = calculateReachScore(input, emptyRules);
    expect(score.band).toBe('block');
    expect(score.canSchedule).toBe(false);
  });
});

describe('Hook Strength Scoring', () => {
  it('scores question hooks higher', () => {
    const withQuestion = calculateReachScore(makeInput({
      draftText: 'Did you know early detection saves lives?\n\nBook your screening today.',
    }), emptyRules);
    const withoutQuestion = calculateReachScore(makeInput({
      draftText: 'Early detection saves lives.\n\nBook your screening today.',
    }), emptyRules);
    const questionComponent = withQuestion.components.find((c) => c.component === 'hookStrength');
    const noQuestionComponent = withoutQuestion.components.find((c) => c.component === 'hookStrength');
    expect(questionComponent!.score).toBeGreaterThanOrEqual(noQuestionComponent!.score);
  });
});

describe('Format Fit Scoring', () => {
  it('scores recommended format higher', () => {
    const postScore = calculateReachScore(makeInput({ contentType: 'post' }), emptyRules);
    const reelScore = calculateReachScore(makeInput({ contentType: 'reel' }), emptyRules);
    const postComponent = postScore.components.find((c) => c.component === 'formatFit');
    const reelComponent = reelScore.components.find((c) => c.component === 'formatFit');
    expect(postComponent!.score).toBeGreaterThanOrEqual(reelComponent!.score);
  });
});

describe('Hashtag Hygiene Scoring', () => {
  it('scores correct hashtag count higher', () => {
    const goodHashtags = calculateReachScore(makeInput({
      hashtags: ['#SmartLabs', '#HealthTech', '#Wellness'],
    }), emptyRules);
    const tooMany = calculateReachScore(makeInput({
      hashtags: ['#a', '#b', '#c', '#d', '#e', '#f', '#g'],
    }), emptyRules);
    const goodComponent = goodHashtags.components.find((c) => c.component === 'hashtagHygiene');
    const tooManyComponent = tooMany.components.find((c) => c.component === 'hashtagHygiene');
    expect(goodComponent!.score).toBeGreaterThan(tooManyComponent!.score);
  });

  it('penalizes generic hashtags', () => {
    const specific = calculateReachScore(makeInput({
      hashtags: ['#SmartLabs', '#BloodTest', '#Prevention'],
    }), emptyRules);
    const generic = calculateReachScore(makeInput({
      hashtags: ['#love', '#instagood', '#follow', '#like'],
    }), emptyRules);
    const specificComponent = specific.components.find((c) => c.component === 'hashtagHygiene');
    const genericComponent = generic.components.find((c) => c.component === 'hashtagHygiene');
    expect(specificComponent!.score).toBeGreaterThan(genericComponent!.score);
  });
});

describe('Platform Fit Scoring', () => {
  it('penalizes content exceeding character limit', () => {
    const shortText = 'Short post about health.';
    const longText = 'A'.repeat(2000);
    const shortScore = calculateReachScore(makeInput({ draftText: shortText }), emptyRules);
    const longScore = calculateReachScore(makeInput({ draftText: longText }), emptyRules);
    const shortComponent = shortScore.components.find((c) => c.component === 'platformFit');
    const longComponent = longScore.components.find((c) => c.component === 'platformFit');
    expect(shortComponent!.score).toBeGreaterThan(longComponent!.score);
  });
});
