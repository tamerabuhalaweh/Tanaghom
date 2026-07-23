import { describe, expect, it } from 'vitest';
import {
  evaluateGovernedEventKpis,
  thresholdConfigurationError,
  type GovernedKpiTargetSnapshot,
  type VerifiedEventKpiSnapshot,
} from '../evaluation';

const record = (
  overrides: Partial<VerifiedEventKpiSnapshot> = {},
): VerifiedEventKpiSnapshot => ({
  metricDate: new Date('2026-07-22T12:00:00.000Z'),
  leads: 10,
  impressions: 1000,
  interactions: 60,
  purchases: 2,
  spend: 400,
  ...overrides,
});

const target = (
  overrides: Partial<GovernedKpiTargetSnapshot> = {},
): GovernedKpiTargetSnapshot => ({
  id: 'target-1',
  metricKey: 'cost_per_lead',
  label: 'Maximum cost per lead',
  unit: 'currency',
  direction: 'maximum',
  currency: 'AED',
  targetValue: 40,
  warningValue: 45,
  criticalValue: 60,
  ...overrides,
});

describe('governed event KPI evaluation', () => {
  it('classifies maximum and minimum KPI thresholds from verified evidence', () => {
    const result = evaluateGovernedEventKpis(
      [
        target(),
        target({
          id: 'target-2',
          metricKey: 'interaction_rate',
          label: 'Minimum interaction rate',
          unit: 'percentage',
          direction: 'minimum',
          currency: null,
          targetValue: 8,
          warningValue: 7,
          criticalValue: 5,
        }),
      ],
      [record()],
    );

    expect(result.evaluations[0]).toMatchObject({
      actualValue: 40,
      status: 'on_track',
      source: 'verified_event_kpi_records',
    });
    expect(result.evaluations[1]).toMatchObject({
      actualValue: 6,
      status: 'warning',
    });
    expect(result.summary).toMatchObject({ onTrack: 1, warning: 1, critical: 0 });
  });

  it('uses only the latest evidence day for daily ad spend', () => {
    const result = evaluateGovernedEventKpis(
      [
        target({
          metricKey: 'daily_ad_spend',
          label: 'Maximum daily ad spend',
          targetValue: 500,
          warningValue: 600,
          criticalValue: 750,
        }),
      ],
      [
        record({ metricDate: new Date('2026-07-21T12:00:00.000Z'), spend: 900 }),
        record({ metricDate: new Date('2026-07-22T08:00:00.000Z'), spend: 300 }),
        record({ metricDate: new Date('2026-07-22T18:00:00.000Z'), spend: 500 }),
      ],
    );

    expect(result.evaluations[0]).toMatchObject({
      actualValue: 800,
      status: 'critical',
      evidenceRecordCount: 2,
    });
  });

  it('reports missing thresholds and missing verified data honestly', () => {
    const result = evaluateGovernedEventKpis(
      [
        target({ warningValue: null, criticalValue: null }),
        target({ id: 'target-2', metricKey: 'interaction_rate', currency: null }),
      ],
      [record({ impressions: 0 })],
    );

    expect(result.evaluations[0].status).toBe('thresholds_missing');
    expect(result.evaluations[1]).toMatchObject({
      actualValue: null,
      status: 'actual_unavailable',
    });
  });

  it('does not treat purchase count as ticket quantity', () => {
    const result = evaluateGovernedEventKpis(
      [
        target({
          metricKey: 'ticket_sales',
          label: 'Ticket sales target',
          unit: 'count',
          direction: 'target',
          currency: null,
          targetValue: 500,
          warningValue: null,
          criticalValue: null,
        }),
      ],
      [record({ purchases: 200 })],
    );

    expect(result.evaluations[0]).toMatchObject({
      actualValue: null,
      status: 'actual_unavailable',
      source: 'customer_mapping_required',
    });
    expect(result.evaluations[0].reason).toContain('ticket-quantity mapping');
  });

  it('validates threshold completeness and ordering without inventing defaults', () => {
    expect(thresholdConfigurationError('maximum', 40, 45, null)).toContain('together');
    expect(thresholdConfigurationError('maximum', 40, 35, 60)).toContain('below its target');
    expect(thresholdConfigurationError('maximum', 40, 45, 44)).toContain('critical');
    expect(thresholdConfigurationError('minimum', 8, 9, 5)).toContain('above its target');
    expect(thresholdConfigurationError('minimum', 8, 7, 7.5)).toContain('critical');
    expect(thresholdConfigurationError('minimum', 8, 7, 5)).toBeNull();
  });
});
