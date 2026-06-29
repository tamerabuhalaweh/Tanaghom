import { describe, expect, it } from 'vitest';
import {
  ALGORITHM_GUIDANCE_RULES,
  ALGORITHM_KNOWLEDGE_SOURCES,
  COURSE_CAMPAIGN_TEMPLATES,
} from './data';
import { listCourseCampaignTemplates } from './service';

describe('social growth product registry', () => {
  it('uses unique course campaign template IDs with actionable course-sales fields', () => {
    const ids = COURSE_CAMPAIGN_TEMPLATES.map(template => template.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(COURSE_CAMPAIGN_TEMPLATES.length).toBeGreaterThanOrEqual(5);

    for (const template of COURSE_CAMPAIGN_TEMPLATES) {
      const searchable = `${template.name} ${template.useCase} ${template.recommendedFor} ${template.objective} ${template.expectedOutcome}`.toLowerCase();
      expect(template.name).toBeTruthy();
      expect(searchable).toMatch(/course|learning|registration|coaching|lead|event/);
      expect(template.cta.length).toBeGreaterThan(10);
      expect(template.targetPlatforms.length).toBeGreaterThan(0);
      expect(template.recommendedFunnel.length).toBeGreaterThanOrEqual(4);
      expect(template.expectedOutcome.toLowerCase()).toMatch(/lead|registration|interest|inquiries/);
    }
  });

  it('does not claim private social algorithm access', () => {
    const packText = JSON.stringify({
      sources: ALGORITHM_KNOWLEDGE_SOURCES,
      rules: ALGORITHM_GUIDANCE_RULES,
    }).toLowerCase();

    expect(packText).not.toContain('private algorithm imported');
    expect(packText).not.toContain('secret instagram algorithm');
    expect(packText).not.toContain('fake engagement');
    expect(packText).not.toContain('scraping');
  });

  it('requires every algorithm guidance rule to point to a governed source', () => {
    const sourceIds = new Set(ALGORITHM_KNOWLEDGE_SOURCES.map(source => source.id));

    for (const source of ALGORITHM_KNOWLEDGE_SOURCES) {
      expect(source.sourceUrl).toBeTruthy();
      expect(source.lastReviewed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(['official_docs', 'official_policy', 'open_source_reference', 'internal_analytics']).toContain(source.sourceType);
    }

    for (const rule of ALGORITHM_GUIDANCE_RULES) {
      expect(sourceIds.has(rule.sourceId)).toBe(true);
      expect(rule.recommendation.length).toBeGreaterThan(20);
      expect(rule.businessImpact.length).toBeGreaterThan(20);
      expect(rule.canInfluenceScore).toBe(true);
    }
  });

  it('exposes templates through the service without secrets or external execution', () => {
    const result = listCourseCampaignTemplates();
    expect(result.templates).toHaveLength(COURSE_CAMPAIGN_TEMPLATES.length);
    expect(JSON.stringify(result).toLowerCase()).not.toContain('api_key');
    expect(JSON.stringify(result).toLowerCase()).not.toContain('publish now');
  });
});
