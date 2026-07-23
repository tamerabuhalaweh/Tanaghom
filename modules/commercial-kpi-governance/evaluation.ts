export const KPI_EVALUATION_STATUSES = [
  'on_track',
  'warning',
  'critical',
  'thresholds_missing',
  'actual_unavailable',
] as const;

export type KpiEvaluationStatus = (typeof KPI_EVALUATION_STATUSES)[number];

export interface GovernedKpiTargetSnapshot {
  id: string;
  metricKey: string;
  label: string;
  unit: string;
  direction: string;
  currency: string | null;
  targetValue: number;
  warningValue: number | null;
  criticalValue: number | null;
  lowerBound?: number | null;
  upperBound?: number | null;
  appliedAs?: string;
}

export interface VerifiedEventKpiSnapshot {
  metricDate: Date;
  leads: number;
  impressions: number;
  interactions: number;
  purchases: number;
  spend: number;
}

export interface GovernedKpiEvaluation {
  targetId: string;
  metricKey: string;
  label: string;
  status: KpiEvaluationStatus;
  actualValue: number | null;
  targetValue: number;
  warningValue: number | null;
  criticalValue: number | null;
  variance: number | null;
  unit: string;
  currency: string | null;
  source: 'verified_event_kpi_records' | 'customer_mapping_required';
  evidenceDate: Date | null;
  evidenceRecordCount: number;
  reason: string;
}

export interface GovernedKpiEvaluationSummary {
  total: number;
  onTrack: number;
  warning: number;
  critical: number;
  thresholdsMissing: number;
  actualUnavailable: number;
}

export function thresholdConfigurationError(
  direction: string,
  targetValue: number,
  warningValue: number | null | undefined,
  criticalValue: number | null | undefined,
): string | null {
  const hasWarning = warningValue != null;
  const hasCritical = criticalValue != null;
  if (hasWarning !== hasCritical) {
    return 'Warning and critical thresholds must be configured together';
  }
  if (!hasWarning || !hasCritical) return null;

  if (direction === 'maximum') {
    if (warningValue < targetValue) {
      return 'A maximum KPI warning threshold cannot be below its target';
    }
    if (criticalValue < warningValue) {
      return 'A maximum KPI critical threshold cannot be below its warning threshold';
    }
  }
  if (direction === 'minimum') {
    if (warningValue > targetValue) {
      return 'A minimum KPI warning threshold cannot be above its target';
    }
    if (criticalValue > warningValue) {
      return 'A minimum KPI critical threshold cannot be above its warning threshold';
    }
  }
  return null;
}

export function evaluateGovernedEventKpis(
  targets: GovernedKpiTargetSnapshot[],
  records: VerifiedEventKpiSnapshot[],
): {
  evaluations: GovernedKpiEvaluation[];
  summary: GovernedKpiEvaluationSummary;
  latestEvidenceAt: Date | null;
} {
  const latestEvidenceAt = records.reduce<Date | null>(
    (latest, record) => (!latest || record.metricDate > latest ? record.metricDate : latest),
    null,
  );
  const evaluations = targets.map((target) => evaluateTarget(target, records));
  return {
    evaluations,
    summary: {
      total: evaluations.length,
      onTrack: count(evaluations, 'on_track'),
      warning: count(evaluations, 'warning'),
      critical: count(evaluations, 'critical'),
      thresholdsMissing: count(evaluations, 'thresholds_missing'),
      actualUnavailable: count(evaluations, 'actual_unavailable'),
    },
    latestEvidenceAt,
  };
}

function evaluateTarget(
  target: GovernedKpiTargetSnapshot,
  records: VerifiedEventKpiSnapshot[],
): GovernedKpiEvaluation {
  const actual = actualFor(target.metricKey, records);
  const base = {
    targetId: target.id,
    metricKey: target.metricKey,
    label: target.label,
    actualValue: actual.value,
    targetValue: target.targetValue,
    warningValue: target.warningValue,
    criticalValue: target.criticalValue,
    variance: actual.value == null ? null : round(actual.value - target.targetValue),
    unit: target.unit,
    currency: target.currency,
    source: actual.source,
    evidenceDate: actual.evidenceDate,
    evidenceRecordCount: actual.evidenceRecordCount,
  };

  if (actual.value == null) {
    return { ...base, status: 'actual_unavailable', reason: actual.reason };
  }
  if (
    !['minimum', 'maximum'].includes(target.direction) ||
    target.warningValue == null ||
    target.criticalValue == null
  ) {
    return {
      ...base,
      status: 'thresholds_missing',
      reason:
        target.direction === 'minimum' || target.direction === 'maximum'
          ? 'The CCO must configure both warning and critical thresholds before automatic monitoring can classify this KPI.'
          : 'This target has no approved warning and critical tolerance policy.',
    };
  }

  if (target.direction === 'maximum') {
    if (actual.value >= target.criticalValue) {
      return { ...base, status: 'critical', reason: 'Actual performance reached or exceeded the approved critical ceiling.' };
    }
    if (actual.value >= target.warningValue) {
      return { ...base, status: 'warning', reason: 'Actual performance reached or exceeded the approved warning ceiling.' };
    }
  } else {
    if (actual.value <= target.criticalValue) {
      return { ...base, status: 'critical', reason: 'Actual performance reached or fell below the approved critical floor.' };
    }
    if (actual.value <= target.warningValue) {
      return { ...base, status: 'warning', reason: 'Actual performance reached or fell below the approved warning floor.' };
    }
  }
  return { ...base, status: 'on_track', reason: 'Verified actual performance remains within the approved operating thresholds.' };
}

function actualFor(
  metricKey: string,
  records: VerifiedEventKpiSnapshot[],
): {
  value: number | null;
  source: GovernedKpiEvaluation['source'];
  evidenceDate: Date | null;
  evidenceRecordCount: number;
  reason: string;
} {
  if (metricKey === 'ticket_sales') {
    return unavailable(
      'Ticket quantity is not stored in the current KPI evidence model. Customer-approved GHL ticket-quantity mapping is required before this target can be evaluated.',
      'customer_mapping_required',
    );
  }
  if (!records.length) {
    return unavailable('No verified KPI evidence is available for this event.');
  }

  const latest = records.reduce((current, record) =>
    record.metricDate > current.metricDate ? record : current,
  );
  const total = records.reduce(
    (sum, record) => ({
      leads: sum.leads + record.leads,
      impressions: sum.impressions + record.impressions,
      interactions: sum.interactions + record.interactions,
      purchases: sum.purchases + record.purchases,
      spend: sum.spend + record.spend,
    }),
    { leads: 0, impressions: 0, interactions: 0, purchases: 0, spend: 0 },
  );
  const available = (value: number, evidenceDate = latest.metricDate, evidenceRecordCount = records.length) => ({
    value: round(value),
    source: 'verified_event_kpi_records' as const,
    evidenceDate,
    evidenceRecordCount,
    reason: '',
  });

  if (metricKey === 'cost_per_lead') {
    return total.leads > 0
      ? available(total.spend / total.leads)
      : unavailable('Verified records do not contain any leads, so cost per lead cannot be calculated.');
  }
  if (metricKey === 'interaction_rate') {
    return total.impressions > 0
      ? available((total.interactions / total.impressions) * 100)
      : unavailable('Verified records do not contain impressions, so interaction rate cannot be calculated.');
  }
  if (metricKey === 'purchase_conversion_rate') {
    return total.leads > 0
      ? available((total.purchases / total.leads) * 100)
      : unavailable('Verified records do not contain any leads, so purchase conversion cannot be calculated.');
  }
  if (metricKey === 'daily_ad_spend') {
    const latestDay = utcDay(latest.metricDate);
    const dailyRecords = records.filter((record) => utcDay(record.metricDate) === latestDay);
    return available(
      dailyRecords.reduce((sum, record) => sum + record.spend, 0),
      latest.metricDate,
      dailyRecords.length,
    );
  }
  return unavailable(
    `No verified event-evidence mapping is defined for '${metricKey}'.`,
    'customer_mapping_required',
  );
}

function unavailable(
  reason: string,
  source: GovernedKpiEvaluation['source'] = 'verified_event_kpi_records',
) {
  return {
    value: null,
    source,
    evidenceDate: null,
    evidenceRecordCount: 0,
    reason,
  };
}

function count(evaluations: GovernedKpiEvaluation[], status: KpiEvaluationStatus): number {
  return evaluations.filter((evaluation) => evaluation.status === status).length;
}

function utcDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
