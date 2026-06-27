import type {
  ScoreDraftInput,
  ReachReadinessScore,
  ScoreComponentResult,
  OptimizationSuggestion,
  StaleWarning,
  SpamFlag,
  ScoringComponent,
  ScoringBandAction,
  PlatformRuleRecord,
} from './types';
import { SCORING_COMPONENTS, SCORING_BANDS } from './types';
import { PLATFORM_CONSTRAINTS } from '../ai-generation/types';
import type { Platform } from '../ai-generation/types';

// ============================================================
// Medical Claim Terms (explicit block list)
// ============================================================

const MEDICAL_CLAIM_TERMS = [
  'diagnose', 'diagnosis', 'diagnostic',
  'treat', 'treatment', 'treating',
  'cure', 'curing',
  'miracle', 'miraculous',
  'guarantee', 'guaranteed',
  '100% effective',
  'clinically proven',
  'fda approved',
  'eliminates',
  'reverses',
  'heals',
];

// ============================================================
// Main Scoring Function
// ============================================================

export function calculateReachScore(
  input: ScoreDraftInput,
  rules: PlatformRuleRecord[],
): ReachReadinessScore {
  const platform = input.platform as Platform;
  const constraints = PLATFORM_CONSTRAINTS[platform];

  if (!constraints) {
    return {
      contentItemId: input.contentItemId,
      totalScore: 0,
      band: 'block',
      bandLabel: 'Unknown platform',
      components: [],
      optimizationSuggestions: [],
      staleWarnings: [],
      spamFlags: [{ tactic: 'misleading_claims', severity: 'block', evidence: 'Unknown platform', suggestion: 'Use a supported platform' }],
      canSchedule: false,
      blockReasons: ['Unknown platform'],
    };
  }

  const components = scoreComponents(input, constraints);
  const staleWarnings = detectStaleRules(platform, rules);
  const spamFlags = detectSpamTactics(input);
  const totalScore = calculateTotalScore(components);
  const band = getScoringBand(totalScore);
  const optimizationSuggestions = generateSuggestions(components, constraints, rules);
  const blockReasons = getBlockReasons(spamFlags, staleWarnings, band, input.draftText);

  return {
    contentItemId: input.contentItemId,
    totalScore,
    band,
    bandLabel: SCORING_BANDS[band].label,
    components,
    optimizationSuggestions,
    staleWarnings,
    spamFlags,
    canSchedule: blockReasons.length === 0,
    blockReasons,
  };
}

// ============================================================
// Component Scoring
// ============================================================

function scoreComponents(
  input: ScoreDraftInput,
  constraints: typeof PLATFORM_CONSTRAINTS.linkedin,
): ScoreComponentResult[] {
  const text = input.draftText;
  const hashtags = input.hashtags || [];

  return [
    scoreHookStrength(text, constraints),
    scoreFormatFit(input.contentType || 'post', constraints),
    scoreHashtagHygiene(hashtags, constraints),
    scoreTimingPlaceholder(),
    scoreCtaClarity(input.cta || '', text),
    scoreComplianceRisk(input.riskCategory || 'low', text),
    scoreAudienceRelevance(input.audience || ''),
    scoreOriginality(text),
    scorePlatformFit(text, constraints),
  ];
}

function scoreHookStrength(
  text: string,
  constraints: { hookRequired: boolean; maxTextLength: number },
): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.hookStrength.weight;
  let score = 50;
  const explanations: string[] = [];

  if (!constraints.hookRequired) {
    score = 80;
    explanations.push('Hook not required for this platform');
  } else {
    const firstLine = text.split('\n')[0] || text.substring(0, 100);
    const hasQuestion = firstLine.includes('?');
    const hasBoldStatement = firstLine.length > 10 && firstLine === firstLine.toUpperCase();
    const hasNumber = /\d/.test(firstLine);
    const hasEmoji = /[\u{1F600}-\u{1F64F}]/u.test(firstLine);

    if (hasQuestion) { score += 20; explanations.push('Question hook detected'); }
    if (hasBoldStatement) { score += 15; explanations.push('Bold statement hook'); }
    if (hasNumber) { score += 10; explanations.push('Number/stat hook'); }
    if (hasEmoji) { score += 5; explanations.push('Emoji engagement hook'); }
    if (firstLine.length < 10) { score -= 20; explanations.push('Hook too short'); }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    component: 'hookStrength',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; ') || 'Standard hook',
  };
}

function scoreFormatFit(
  contentType: string,
  constraints: { recommendedFormat: string },
): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.formatFit.weight;
  let score = 50;
  const explanations: string[] = [];

  if (contentType === constraints.recommendedFormat) {
    score = 95;
    explanations.push(`Format matches platform recommendation: ${constraints.recommendedFormat}`);
  } else if (contentType === 'post') {
    score = 70;
    explanations.push('Generic post format, consider platform-specific format');
  } else {
    score = 40;
    explanations.push(`Format ${contentType} not optimal for this platform, consider ${constraints.recommendedFormat}`);
  }

  return {
    component: 'formatFit',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; '),
  };
}

function scoreHashtagHygiene(
  hashtags: string[],
  constraints: { maxHashtags: number },
): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.hashtagHygiene.weight;
  let score = 50;
  const explanations: string[] = [];

  if (constraints.maxHashtags === 0) {
    if (hashtags.length === 0) {
      score = 95;
      explanations.push('No hashtags (correct for this platform)');
    } else {
      score = 30;
      explanations.push('Hashtags not recommended for this platform');
    }
  } else if (hashtags.length === 0) {
    score = 40;
    explanations.push('No hashtags used, consider adding relevant ones');
  } else if (hashtags.length > constraints.maxHashtags) {
    score = 20;
    explanations.push(`Too many hashtags (${hashtags.length}/${constraints.maxHashtags}), reduce to ${constraints.maxHashtags}`);
  } else if (hashtags.length >= 1 && hashtags.length <= constraints.maxHashtags) {
    score = 85;
    explanations.push(`Good hashtag count (${hashtags.length}/${constraints.maxHashtags})`);

    const hasGeneric = hashtags.some((h) => ['#love', '#instagood', '#follow', '#like'].includes(h.toLowerCase()));
    if (hasGeneric) {
      score -= 20;
      explanations.push('Generic hashtags detected, use niche-specific ones');
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    component: 'hashtagHygiene',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; '),
  };
}

function scoreTimingPlaceholder(): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.timingPlaceholder.weight;
  const score = 70;

  return {
    component: 'timingPlaceholder',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: 'Timing recommendation uses demo intelligence until official analytics connectors are authorized',
  };
}

function scoreCtaClarity(cta: string, fullText: string): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.ctaClarity.weight;
  let score = 50;
  const explanations: string[] = [];

  const text = (cta || fullText).toLowerCase();
  const ctaKeywords = ['book', 'sign up', 'learn more', 'discover', 'get started', 'try', 'download', 'subscribe', 'join', 'contact', 'visit', 'click', 'shop', 'order', 'register'];
  const hasCta = ctaKeywords.some((k) => text.includes(k));

  if (cta && cta.length > 0) {
    score += 25;
    explanations.push('Explicit CTA provided');
  }

  if (hasCta) {
    score += 20;
    explanations.push('Action-oriented language detected');
  }

  const hasUrgency = ['today', 'now', 'limited', 'hurry', 'last chance', 'ending soon'].some((w) => text.includes(w));
  if (hasUrgency) {
    score += 10;
    explanations.push('Urgency elements present');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    component: 'ctaClarity',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; ') || 'CTA could be more explicit',
  };
}

function scoreComplianceRisk(riskCategory: string, text: string): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.complianceRisk.weight;
  let score = 80;
  const explanations: string[] = [];

  if (riskCategory === 'high') {
    score = 30;
    explanations.push('High-risk content — compliance review required');
  } else if (riskCategory === 'medium') {
    score = 60;
    explanations.push('Medium-risk content — brand review recommended');
  } else {
    score = 90;
    explanations.push('Low-risk content');
  }

  const lowerText = text.toLowerCase();
  const hasMedicalClaim = MEDICAL_CLAIM_TERMS.some((c) => lowerText.includes(c));
  if (hasMedicalClaim) {
    score = Math.min(score, 20);
    explanations.push('Medical claims detected — requires compliance review');
  }

  const superlatives = ['best', 'greatest', 'unmatched', 'revolutionary', 'breakthrough'];
  const hasSuperlative = superlatives.some((s) => lowerText.includes(s));
  if (hasSuperlative) {
    score -= 15;
    explanations.push('Superlative claims detected — verify substantiation');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    component: 'complianceRisk',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; '),
  };
}

function scoreAudienceRelevance(audience: string): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.audienceRelevance.weight;
  let score = 50;
  const explanations: string[] = [];

  if (audience && audience.length > 10) {
    score = 80;
    explanations.push('Audience defined — content can be targeted');
  } else if (audience && audience.length > 0) {
    score = 60;
    explanations.push('Audience partially defined');
  } else {
    score = 40;
    explanations.push('No audience defined — content may be too generic');
  }

  return {
    component: 'audienceRelevance',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; '),
  };
}

function scoreOriginality(text: string): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.originality.weight;
  let score = 70;
  const explanations: string[] = [];

  const wordCount = text.split(/\s+/).length;
  if (wordCount < 10) {
    score -= 20;
    explanations.push('Content very short — may appear low-effort');
  }

  const hasTemplate = ['check out', 'don\'t miss', 'limited time offer'].some((t) => text.toLowerCase().includes(t));
  if (hasTemplate) {
    score -= 15;
    explanations.push('Template language detected — add unique value');
  }

  const uniqueWords = new Set(text.toLowerCase().split(/\s+/)).size;
  const uniqueRatio = uniqueWords / Math.max(wordCount, 1);
  if (uniqueRatio > 0.7) {
    score += 15;
    explanations.push('Good vocabulary diversity');
  }

  score = Math.max(0, Math.min(100, score));

  return {
    component: 'originality',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; ') || 'Standard originality',
  };
}

function scorePlatformFit(
  text: string,
  constraints: { maxTextLength: number; notes: string },
): ScoreComponentResult {
  const weight = SCORING_COMPONENTS.platformFit.weight;
  let score = 70;
  const explanations: string[] = [];

  if (text.length <= constraints.maxTextLength) {
    score = 90;
    explanations.push(`Within character limit (${text.length}/${constraints.maxTextLength})`);
  } else {
    score = 30;
    explanations.push(`Exceeds character limit (${text.length}/${constraints.maxTextLength}) — will be truncated`);
  }

  return {
    component: 'platformFit',
    score,
    weight,
    weightedScore: (score * weight) / 100,
    maxWeightedScore: weight,
    explanation: explanations.join('; '),
  };
}

// ============================================================
// Stale Rule Detection
// ============================================================

function detectStaleRules(
  platform: string,
  rules: PlatformRuleRecord[],
): StaleWarning[] {
  const warnings: StaleWarning[] = [];
  const now = new Date();

  for (const rule of rules) {
    if (rule.platform !== platform) continue;

    const lastReviewed = rule.lastReviewedAt;
    if (!lastReviewed) {
      warnings.push({
        platform: rule.platform,
        ruleType: rule.ruleType,
        lastReviewed: null,
        daysSinceReview: -1,
        severity: 'block',
        message: `Rule "${rule.ruleType}" has never been reviewed — must review before scheduling`,
      });
      continue;
    }

    const daysSince = Math.floor((now.getTime() - lastReviewed.getTime()) / (1000 * 60 * 60 * 24));
    let severity: 'none' | 'warning' | 'block' = 'none';

    if (daysSince > 90) {
      severity = 'block';
    } else if (daysSince > 60) {
      severity = 'warning';
    } else if (daysSince > 30) {
      severity = 'warning';
    }

    if (severity !== 'none') {
      warnings.push({
        platform: rule.platform,
        ruleType: rule.ruleType,
        lastReviewed,
        daysSinceReview: daysSince,
        severity,
        message: `Rule "${rule.ruleType}" is ${daysSince > 90 ? 'expired' : daysSince > 60 ? 'stale' : 'aging'} — last reviewed ${daysSince} days ago`,
      });
    }
  }

  return warnings;
}

// ============================================================
// Spam/Black-hat Detection
// ============================================================

function detectSpamTactics(input: ScoreDraftInput): SpamFlag[] {
  const flags: SpamFlag[] = [];
  const text = input.draftText.toLowerCase();
  const hashtags = (input.hashtags || []).map((h: string) => h.toLowerCase());

  if (text.includes('like and share') || text.includes('tag a friend') || text.includes('comment below')) {
    flags.push({
      tactic: 'engagement_bait',
      severity: 'block',
      evidence: 'Engagement bait language detected',
      suggestion: 'Remove explicit engagement requests — let content drive organic engagement',
    });
  }

  if (hashtags.length > 0) {
    const genericCount = hashtags.filter((h: string) =>
      ['#love', '#instagood', '#follow', '#like', '#photooftheday', '#beautiful', '#happy', '#cute', '#tbt', '#fashion'].includes(h),
    ).length;
    if (genericCount > 3) {
      flags.push({
        tactic: 'hashtag_stuffing',
        severity: 'warning',
        evidence: `${genericCount} generic hashtags detected`,
        suggestion: 'Replace generic hashtags with niche-specific, relevant ones',
      });
    }
  }

  const misleadingPhrases = ['doctors hate this', 'one weird trick', 'they don\'t want you to know', 'secret revealed', 'miracle cure'];
  const hasMisleading = misleadingPhrases.some((p) => text.includes(p));
  if (hasMisleading) {
    flags.push({
      tactic: 'misleading_claims',
      severity: 'block',
      evidence: 'Misleading clickbait phrases detected',
      suggestion: 'Remove misleading claims — use evidence-based messaging',
    });
  }

  const fakeUrgencyPhrases = ['only 1 left', 'act now or miss out', 'limited spots remaining', 'expires in minutes'];
  const hasFakeUrgency = fakeUrgencyPhrases.some((p) => text.includes(p));
  if (hasFakeUrgency) {
    flags.push({
      tactic: 'fake_urgency',
      severity: 'warning',
      evidence: 'Artificial urgency language detected',
      suggestion: 'Use genuine urgency or remove time pressure language',
    });
  }

  if (input.hashtags && input.hashtags.length > 15) {
    flags.push({
      tactic: 'hashtag_stuffing',
      severity: 'block',
      evidence: `Excessive hashtags: ${input.hashtags.length}`,
      suggestion: 'Reduce hashtags to platform-recommended count',
    });
  }

  return flags;
}

// ============================================================
// Medical Claim Detection (explicit blocking)
// ============================================================

function detectMedicalClaims(text: string): { detected: boolean; terms: string[] } {
  const lowerText = text.toLowerCase();
  const foundTerms = MEDICAL_CLAIM_TERMS.filter((term) => lowerText.includes(term));
  return { detected: foundTerms.length > 0, terms: foundTerms };
}

// ============================================================
// Scoring Helpers
// ============================================================

function calculateTotalScore(components: ScoreComponentResult[]): number {
  const totalWeighted = components.reduce((sum, c) => sum + c.weightedScore, 0);
  const totalMax = components.reduce((sum, c) => sum + c.maxWeightedScore, 0);
  return Math.round((totalWeighted / totalMax) * 100);
}

function getScoringBand(score: number): ScoringBandAction {
  if (score >= 90) return 'approve';
  if (score >= 75) return 'optimize';
  if (score >= 60) return 'revise';
  return 'block';
}

function generateSuggestions(
  components: ScoreComponentResult[],
  constraints: { recommendedFormat: string; maxHashtags: number; hookRequired: boolean },
  rules: PlatformRuleRecord[],
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const now = new Date();

  for (const c of components) {
    if (c.score >= 80) continue;

    const relatedRule = rules.find((r) => r.ruleType === c.component);
    const suggestion = getSuggestionForComponent(c.component, c.score, constraints, now, relatedRule);
    if (suggestion) {
      suggestions.push(suggestion);
    }
  }

  return suggestions.sort((a, b) => b.expectedImprovement - a.expectedImprovement);
}

function getSuggestionForComponent(
  component: ScoringComponent,
  score: number,
  constraints: { recommendedFormat: string; maxHashtags: number; hookRequired: boolean },
  now: Date,
  relatedRule?: PlatformRuleRecord,
): OptimizationSuggestion | null {
  const improvement = 80 - score;
  const baseMetadata = {
    source: 'scoring-engine',
    sourceType: 'scoring_engine' as const,
    checkedAt: now,
    confidence: 'medium' as const,
    relatedRuleId: relatedRule?.id,
  };

  switch (component) {
    case 'hookStrength':
      return {
        ...baseMetadata,
        component,
        priority: improvement > 30 ? 'high' : 'medium',
        suggestion: constraints.hookRequired
          ? 'Add a strong opening hook — question, bold statement, or surprising statistic'
          : 'Consider adding an engaging opening line',
        expectedImprovement: Math.min(improvement, 25),
        source: relatedRule?.sourceUrl || 'platform-best-practices',
        sourceType: relatedRule ? 'platform_rules' : 'scoring_engine',
        confidence: (relatedRule?.confidence as 'low' | 'medium' | 'high') || 'medium',
      };
    case 'formatFit':
      return {
        ...baseMetadata,
        component,
        priority: 'medium',
        suggestion: `Consider using ${constraints.recommendedFormat} format for better platform performance`,
        expectedImprovement: Math.min(improvement, 20),
        source: relatedRule?.sourceUrl || 'platform-format-rules',
        sourceType: relatedRule ? 'platform_rules' : 'scoring_engine',
        confidence: (relatedRule?.confidence as 'low' | 'medium' | 'high') || 'medium',
      };
    case 'hashtagHygiene':
      return {
        ...baseMetadata,
        component,
        priority: 'medium',
        suggestion: `Use ${constraints.maxHashtags} relevant, niche-specific hashtags instead of generic ones`,
        expectedImprovement: Math.min(improvement, 15),
        source: relatedRule?.sourceUrl || 'platform-hashtag-guidelines',
        sourceType: relatedRule ? 'platform_rules' : 'scoring_engine',
        confidence: (relatedRule?.confidence as 'low' | 'medium' | 'high') || 'medium',
      };
    case 'ctaClarity':
      return {
        ...baseMetadata,
        component,
        priority: 'high',
        suggestion: 'Add a clear call-to-action with action verbs (Book, Discover, Learn More)',
        expectedImprovement: Math.min(improvement, 20),
        source: 'conversion-optimization',
        sourceType: 'internal_analytics',
        confidence: 'high',
      };
    case 'complianceRisk':
      return {
        ...baseMetadata,
        component,
        priority: 'high',
        suggestion: 'Remove medical claims, superlatives, or unverified statements',
        expectedImprovement: Math.min(improvement, 30),
        source: 'compliance-policy',
        sourceType: 'official_docs',
        confidence: 'high',
      };
    case 'platformFit':
      return {
        ...baseMetadata,
        component,
        priority: 'high',
        suggestion: 'Shorten content to fit platform character limit',
        expectedImprovement: Math.min(improvement, 30),
        source: relatedRule?.sourceUrl || 'platform-character-limits',
        sourceType: relatedRule ? 'platform_rules' : 'scoring_engine',
        confidence: (relatedRule?.confidence as 'low' | 'medium' | 'high') || 'high',
      };
    case 'timingPlaceholder':
      return {
        ...baseMetadata,
        component,
        priority: 'low',
        suggestion: 'Review the recommended posting time against campaign audience activity before scheduling',
        expectedImprovement: Math.min(improvement, 10),
        source: 'demo-intelligence',
        sourceType: 'scoring_engine',
        confidence: 'medium',
      };
    default:
      return {
        ...baseMetadata,
        component,
        priority: 'low',
        suggestion: 'Improve this readiness factor for better reach',
        expectedImprovement: Math.min(improvement, 10),
        source: 'scoring-engine',
        sourceType: 'scoring_engine',
        confidence: 'low',
      };
  }
}

function getBlockReasons(
  spamFlags: SpamFlag[],
  staleWarnings: StaleWarning[],
  band: ScoringBandAction,
  draftText: string,
): string[] {
  const reasons: string[] = [];

  // Medical claims explicitly block scheduling
  const medicalClaims = detectMedicalClaims(draftText);
  if (medicalClaims.detected) {
    reasons.push(`Medical claims detected (${medicalClaims.terms.join(', ')}) — requires compliance review before scheduling`);
  }

  const blockSpam = spamFlags.filter((f) => f.severity === 'block');
  if (blockSpam.length > 0) {
    reasons.push(`Spam/black-hat tactics detected: ${blockSpam.map((f) => f.tactic).join(', ')}`);
  }

  const blockStale = staleWarnings.filter((w) => w.severity === 'block');
  if (blockStale.length > 0) {
    reasons.push(`Stale platform rules: ${blockStale.map((w) => w.ruleType).join(', ')}`);
  }

  // Revise band blocks scheduling (no manual override workflow implemented yet)
  if (band === 'revise') {
    reasons.push('Reach Readiness Score in revise range (60-74) — requires revision before scheduling');
  }

  if (band === 'block') {
    reasons.push('Reach Readiness Score below 60 — requires revision');
  }

  return reasons;
}
