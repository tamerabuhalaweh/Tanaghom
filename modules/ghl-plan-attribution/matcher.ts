export interface GhlAttributionRuleSet {
  pipeline_id: string | null;
  identifying_tags: string[];
  source_values: string[];
  match_mode: 'any' | 'all';
  custom_field_rules: unknown;
}

export interface GhlAttributionCandidate {
  pipelineIds: string[];
  tags: string[];
  source: string | null;
  customFields: Record<string, unknown>;
}

export interface GhlAttributionCheck {
  rule: string;
  matched: boolean;
}

export interface GhlAttributionEvaluation {
  matched: boolean;
  checks: GhlAttributionCheck[];
  missingCustomFields: string[];
}

type CustomFieldRule = {
  field: string;
  operator: 'equals' | 'contains' | 'exists';
  value?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function parseRules(value: unknown): CustomFieldRule[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (rule): rule is CustomFieldRule =>
      typeof rule === 'object' &&
      rule !== null &&
      'field' in rule &&
      typeof rule.field === 'string' &&
      'operator' in rule &&
      ['equals', 'contains', 'exists'].includes(String(rule.operator)),
  );
}

function customFieldValue(
  customFields: Record<string, unknown>,
  field: string,
): { found: boolean; value: unknown } {
  if (Object.prototype.hasOwnProperty.call(customFields, field)) {
    return { found: true, value: customFields[field] };
  }
  const normalizedField = normalize(field);
  const key = Object.keys(customFields).find((candidate) => normalize(candidate) === normalizedField);
  return key ? { found: true, value: customFields[key] } : { found: false, value: undefined };
}

export function evaluateGhlAttribution(
  mapping: GhlAttributionRuleSet,
  candidate: GhlAttributionCandidate,
): GhlAttributionEvaluation {
  const checks: GhlAttributionCheck[] = [];
  const missingCustomFields: string[] = [];
  const pipelineIds = new Set(candidate.pipelineIds.map(normalize).filter(Boolean));
  const tags = new Set(candidate.tags.map(normalize).filter(Boolean));
  const source = normalize(candidate.source);

  if (mapping.pipeline_id) {
    checks.push({
      rule: 'pipeline',
      matched: pipelineIds.has(normalize(mapping.pipeline_id)),
    });
  }
  if (mapping.identifying_tags.length > 0) {
    checks.push({
      rule: 'tags',
      matched: mapping.identifying_tags.some((tag) => tags.has(normalize(tag))),
    });
  }
  if (mapping.source_values.length > 0) {
    checks.push({
      rule: 'source',
      matched: Boolean(
        source && mapping.source_values.some((value) => normalize(value) === source),
      ),
    });
  }
  for (const rule of parseRules(mapping.custom_field_rules)) {
    const lookup = customFieldValue(candidate.customFields, rule.field);
    if (!lookup.found) missingCustomFields.push(rule.field);
    const actual = normalize(lookup.value);
    const expected = normalize(rule.value);
    checks.push({
      rule: `custom:${rule.field}`,
      matched:
        lookup.found &&
        (rule.operator === 'exists'
          ? lookup.value !== null && lookup.value !== undefined && actual.length > 0
          : rule.operator === 'equals'
            ? actual === expected
            : actual.includes(expected)),
    });
  }

  return {
    matched:
      checks.length > 0 &&
      (mapping.match_mode === 'all'
        ? checks.every((check) => check.matched)
        : checks.some((check) => check.matched)),
    checks,
    missingCustomFields,
  };
}

export function readGhlCustomField(
  customFields: Record<string, unknown>,
  field: string | null,
): unknown {
  if (!field) return undefined;
  return customFieldValue(customFields, field).value;
}
