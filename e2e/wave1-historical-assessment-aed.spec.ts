import { expect, test, type Page } from '@playwright/test';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'commercial.lead@customer.test',
  name: 'Commercial Department Head',
  role: 'cco',
  tenantKey: 'default',
};

const revenueLine = {
  id: '22222222-2222-4222-8222-222222222222',
  revenueLineType: 'online_course',
  name: 'Online Courses',
  status: 'active',
  configured: true,
  planCount: 1,
  openSignalCount: 0,
};

const evidenceId = '33333333-3333-4333-8333-333333333333';
const findingId = '44444444-4444-4444-8444-444444444444';
const runId = '55555555-5555-4555-8555-555555555555';

function dashboard() {
  return {
    defaultCurrency: 'AED',
    revenueLines: [revenueLine],
    stageSummary: { strategy_planning: 1, implementation_engagement: 0 },
    rollups: { currency: 'mixed', plannedRevenueTarget: 5000, plannedBudget: 1000 },
  };
}

async function installMocks(page: Page) {
  let runCreated = false;
  let generated = false;
  let approved = false;
  let previewPayload: Record<string, unknown> | null = null;
  const unexpected: string[] = [];
  const failedResponses: string[] = [];
  const browserProblems: string[] = [];

  const evidence = [{
    id: evidenceId,
    evidence_type: 'event_kpi',
    source_name: 'Leadership Course - Instagram',
    metric_key: 'channel_performance',
    metric_value: 2500,
    metric_unit: 'AED',
    observed_at: '2026-06-30T00:00:00.000Z',
    payload: { reach: 10000, leads: 100, purchases: 10, spend: 2500, currency: 'AED' },
  }];
  const summary = {
    completedEvents: 2,
    commercialPlans: 2,
    comparisonReady: true,
    operatingActuals: { currency: 'AED', leads: 100, purchases: 10, knownSpend: 2500 },
    targetsByCurrency: { USD: { budgetTarget: 1000, revenueTarget: 5000, plans: 1 } },
    eventComparison: [
      { eventId: 'event-a', eventName: 'Leadership Course - Spring', eventDate: '2026-03-20T00:00:00.000Z', currency: 'AED', reach: 10000, leads: 100, purchases: 10, knownSpend: 2500, knownRevenue: 30000 },
      { eventId: 'event-b', eventName: 'Leadership Course - Autumn', eventDate: '2025-10-20T00:00:00.000Z', currency: 'AED', reach: 8000, leads: 70, purchases: 7, knownSpend: 2100, knownRevenue: 22000 },
    ],
  };
  const run = () => ({
    id: runId,
    title: 'Annual commercial performance assessment',
    date_from: '2025-07-15T00:00:00.000Z',
    date_to: '2026-07-15T23:59:59.999Z',
    status: approved ? 'approved' : generated ? 'generated' : 'evidence_ready',
    evidence_summary: summary,
    missing_data: ['GHL purchase sync is not connected yet.'],
    evidence,
    findings: generated ? [{
      id: findingId,
      finding_type: 'repeat',
      title: 'Repeat the warm-audience launch sequence',
      summary: 'Verified outcomes show qualified leads and purchases from the launch.',
      recommendation: 'Reuse the proven warm-audience sequence in the next course plan.',
      confidence: 0.86,
      evidence_ids: [evidenceId],
      decision: approved ? 'approved' : 'pending',
    }] : [],
  });

  await page.addInitScript(() => window.localStorage.setItem('token', 'wave1-acceptance-token'));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => browserProblems.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.url().includes(':4000') && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):4000\/.*/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/session') return json({ user, agentRep: { id: 'agent-1', name: user.name, status: 'active' } });
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/commercial-command-center/dashboard') return json(dashboard());
    if (path === '/events') return json([{ id: '88888888-8888-4888-8888-888888888888', name: 'Completed Leadership Event', status: 'completed' }]);
    if (path === '/campaigns') return json([{ id: '99999999-9999-4999-8999-999999999999', objective: 'Leadership course campaign', status: 'published' }]);
    if (path === '/commercial-assessments/learning-sets') {
      return json(approved ? [{ id: 'learning-1', title: 'Annual assessment - approved learning', approved_at: '2026-07-15T12:00:00.000Z', findings: [run().findings[0]] }] : []);
    }
    if (path === '/commercial-assessments/preview' && method === 'POST') {
      previewPayload = request.postDataJSON() as Record<string, unknown>;
      return json({ scope: { defaultCurrency: 'AED' }, summary, missingData: ['GHL purchase sync is not connected yet.'], evidence: Array.from({ length: 6 }, (_, index) => ({ ...evidence[0], id: index === 0 ? evidenceId : `66666666-6666-4666-8666-66666666666${index}` })) });
    }
    if (path === '/commercial-assessments' && method === 'GET') {
      return json(runCreated ? [{ ...run(), _count: { evidence: 6, findings: generated ? 1 : 0 } }] : []);
    }
    if (path === '/commercial-assessments' && method === 'POST') {
      runCreated = true;
      return json(run(), 201);
    }
    if (path === `/commercial-assessments/${runId}` && method === 'GET') return json(run());
    if (path === `/commercial-assessments/${runId}/generate` && method === 'POST') {
      generated = true;
      return json(run());
    }
    if (path === `/commercial-assessments/findings/${findingId}/decision` && method === 'POST') {
      approved = true;
      return json(run());
    }
    if (path === '/commercial-command-center/revenue-lines/online_course/dashboard') {
      return json({
        defaultCurrency: 'AED',
        revenueLine,
        rollups: {
          currency: 'mixed',
          plannedRevenueTarget: null,
          plannedBudget: null,
          knownRevenue: 0,
          knownSpend: 0,
          currencyBreakdown: [{ currency: 'USD', plannedRevenueTarget: 5000, plannedBudget: 1000, planCount: 1 }],
        },
        dataStatus: { hasLinkedEvents: false, hasKpiRecords: false, hasLeadRecords: false, missingDataSources: [] },
        plans: [{
          id: '77777777-7777-4777-8777-777777777777',
          revenueLineId: revenueLine.id,
          revenueLineType: 'online_course',
          revenueLineName: 'Online Courses',
          title: 'Intentionally USD historical plan',
          horizon: 'one_year',
          stage: 'strategy_planning',
          status: 'completed',
          currency: 'USD',
          budgetTarget: 1000,
          revenueTarget: 5000,
        }],
        linkedEvents: [],
        availableEvents: [],
        openSignals: [],
        approvedLearning: approved ? [{
          id: findingId,
          type: 'repeat',
          title: 'Repeat the warm-audience launch sequence',
          recommendation: 'Reuse the proven warm-audience sequence in the next course plan.',
          confidence: 0.86,
          assessmentTitle: 'Annual commercial performance assessment',
          approvedAt: '2026-07-15T12:00:00.000Z',
        }] : [],
        nextAction: { label: 'Review the current plan', description: 'Keep planning evidence current.', path: '/commercial-plans' },
      });
    }

    unexpected.push(`${method} ${path}`);
    return json({ error: `Unexpected Wave 1 request: ${method} ${path}` }, 500);
  });

  return {
    assertScopeFilters() {
      expect(previewPayload).toMatchObject({
        eventIds: ['88888888-8888-4888-8888-888888888888'],
        campaignIds: ['99999999-9999-4999-8999-999999999999'],
        audienceQuery: 'previous buyers',
        channels: ['instagram'],
      });
    },
    assertClean() {
      expect(unexpected, 'Wave 1 UI must not call unrelated APIs').toEqual([]);
      expect(failedResponses, 'Wave 1 UI must not receive failed API responses').toEqual([]);
      expect(browserProblems, 'Wave 1 UI must not emit console errors or warnings').toEqual([]);
    },
  };
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('Wave 1 historical assessment and AED default', () => {
  test('CCO creates evidence snapshot, generates findings, and approves reusable learning', async ({ page }) => {
    const monitor = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/commercial-assessment');

    await expect(page.getByRole('heading', { name: 'Historical Assessment' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Assessment/ })).toHaveAttribute('aria-current', 'page');
    await page.getByText('Refine by event, campaign, audience, or channel').click();
    await page.getByLabel('Completed event').selectOption('88888888-8888-4888-8888-888888888888');
    await page.getByLabel('Campaign').selectOption('99999999-9999-4999-8999-999999999999');
    await page.getByLabel('Audience contains').fill('previous buyers');
    await page.getByLabel('Channel').selectOption('instagram');
    await page.getByRole('button', { name: 'Review available evidence' }).click();
    monitor.assertScopeFilters();
    await expect(page.getByText('6').first()).toBeVisible();
    await expect(page.getByText('Completed event comparison')).toBeVisible();
    await expect(page.getByRole('row', { name: /Leadership Course - Spring/ })).toContainText('AED');
    await expect(page.getByText('GHL purchase sync is not connected yet.')).toBeVisible();
    await page.getByRole('button', { name: 'Save evidence snapshot' }).click();
    await expect(page.getByText('Historical evidence was saved as an immutable assessment snapshot.')).toBeVisible();
    await page.getByRole('button', { name: 'Generate findings' }).click();
    await expect(page.getByRole('heading', { name: 'Repeat the warm-audience launch sequence' })).toBeVisible();
    await expect(page.getByText('86% confidence')).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Finding approved for future planning.')).toBeVisible();
    await expect(page.getByText('1 approved finding(s)')).toBeVisible();
    await expectNoOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await expectNoOverflow(page);
    const undersized = await page.locator('.commercial-assessment-page button:visible, .commercial-assessment-page input:visible, .commercial-assessment-page select:visible').evaluateAll(elements => elements.map(element => {
      const box = element.getBoundingClientRect();
      return { label: element.textContent?.trim() || element.getAttribute('aria-label'), width: box.width, height: box.height };
    }).filter(control => control.width < 44 || control.height < 44));
    expect(undersized).toEqual([]);

    await page.getByRole('link', { name: /Planning/ }).click();
    await expect(page.getByRole('heading', { name: 'Approved historical learning' })).toBeVisible();
    await expect(page.getByText('Reuse the proven warm-audience sequence in the next course plan.')).toBeVisible();
    await expect(page.getByText('86% confidence')).toBeVisible();
    await expectNoOverflow(page);
    monitor.assertClean();
  });

  test('new planning defaults to AED while an explicit USD plan remains USD', async ({ page }) => {
    const monitor = await installMocks(page);
    await page.goto('/commercial-plans');

    await expect(page.getByLabel('Currency')).toHaveValue('AED');
    await expect(page.getByRole('button', { name: /Intentionally USD historical plan/ })).toContainText(/\$1,000|US\$1,000/);
    await expect(page.getByRole('heading', { name: 'Currency view' })).toBeVisible();
    await expect(page.getByText('USD', { exact: true })).toBeVisible();
    await expect(page.getByText('Tanaghum never performs an unapproved conversion.')).toBeVisible();
    monitor.assertClean();
  });
});
