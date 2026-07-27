import { describe, expect, it } from 'vitest';
import { getAlertDestinationStatus } from './controller';

describe('operations external alert destination status', () => {
  it('does not claim readiness from an email address without an email transport', () => {
    const status = getAlertDestinationStatus({
      OPERATIONS_ALERT_EMAIL: 'ops@example.com',
    });

    expect(status.configured).toBe(false);
    expect(status.providers).toEqual([]);
  });

  it('reports a configured operations webhook without returning its value', () => {
    const status = getAlertDestinationStatus({
      ALERT_WEBHOOK_URL: 'https://example.invalid/private-hook',
    });

    expect(status.configured).toBe(true);
    expect(status.providers).toEqual(['operations_webhook']);
    expect(JSON.stringify(status)).not.toContain('private-hook');
  });

  it('reports the repository-owned GitHub incident destination', () => {
    const status = getAlertDestinationStatus({
      OPERATIONS_GITHUB_ALERTS_ENABLED: 'true',
    });

    expect(status.configured).toBe(true);
    expect(status.providers).toEqual(['github_external_monitor']);
  });
});
