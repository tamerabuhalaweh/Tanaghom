import { expect, test, type Page } from '@playwright/test';

const user = {
  id: 'user-executive',
  email: 'executive.manager@tanaghum.com',
  name: 'Executive Manager',
  role: 'cco',
  tenantKey: 'default',
};

const agentRep = {
  id: 'agent-executive',
  name: 'Executive Manager Profile',
  status: 'active',
};

function executiveDashboard(reportCreated = false, scheduleCreated = false) {
  return {
    generatedAt: '2026-07-08T12:00:00.000Z',
    period: { startDate: null, endDate: null },
    filters: {},
    metrics: {
      plannedRevenueTarget: 30000,
      knownRevenue: 12000,
      plannedBudget: 5000,
      knownSpend: 3500,
      budgetVariance: 1500,
      leads: 60,
      purchases: 8,
      meetingsBooked: 20,
      meetingsAttended: 15,
      noShows: 5,
      reach: 10000,
      impressions: 18000,
      interactions: 900,
      clicks: 400,
      formCompletions: 80,
      costPerLead: 58.33,
      costPerPurchase: 437.5,
      leadToPurchaseRate: 13.33,
      meetingShowRate: 75,
      formCompletionRate: 20,
    },
    confidence: 'high',
    missingSources: ['Customer-specific KPI thresholds are not finalized; default alert thresholds are being used.'],
    dataFreshness: [
      { source: 'KPI records', status: 'current', lastSeenAt: '2026-07-08T12:00:00.000Z', detail: 'Recent data is available.' },
      { source: 'CRM and leads', status: 'current', lastSeenAt: '2026-07-08T12:00:00.000Z', detail: 'Recent data is available.' },
    ],
    revenueLines: [
      {
        type: 'online_course',
        name: 'Online Courses',
        status: 'active',
        plannedRevenueTarget: 30000,
        plannedBudget: 5000,
        knownRevenue: 12000,
        knownSpend: 3500,
        leads: 60,
        purchases: 8,
      },
    ],
    channelPerformance: [
      {
        channel: 'meta',
        spend: 3500,
        reach: 10000,
        leads: 60,
        purchases: 8,
        costPerLead: 58.33,
        costPerPurchase: 437.5,
      },
    ],
    sourceBreakdown: [{ sourceType: 'connector', records: 1, spend: 3500, leads: 60, purchases: 8 }],
    disciplineSummary: { total: 3, active: 2, blocked: 1, completed: 0, critical: 1 },
    connectorReadiness: { jobs: 2, readyForSync: 1, synced: 1, blocked: 0, lastSyncAt: '2026-07-08T12:00:00.000Z' },
    alerts: [
      {
        code: 'high_no_show_rate',
        severity: 'risk',
        title: 'No-show rate needs attention',
        detail: '5 no-show(s) out of 20 booked meeting(s).',
        recommendedAction: 'Add reminder workflow, confirmation messaging, and same-day follow-up.',
      },
    ],
    reports: {
      recent: reportCreated ? [{
        id: 'report-1',
        cadence: 'weekly',
        status: 'preview',
        title: 'Weekly commercial executive report',
        confidence: 'high',
        createdAt: '2026-07-08T12:00:00.000Z',
      }] : [],
      activeSchedules: scheduleCreated ? [{
        id: 'schedule-1',
        cadence: 'weekly',
        deliveryChannels: ['dashboard'],
        status: 'active',
        approvalRequired: true,
        createdAt: '2026-07-08T12:00:00.000Z',
      }] : [],
      nextRecommendedCadence: 'weekly',
    },
    stitchi: {
      suggestedPrompt: 'Stitchi, summarize the executive dashboard.',
    },
  };
}

async function installExecutiveMocks(page: Page) {
  let reportCreated = false;
  let scheduleCreated = false;
  const unexpectedRequests: string[] = [];
  const failedResponses: string[] = [];
  const consoleErrors: string[] = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    const status = response.status();
    const url = response.url();
    if (url.includes(':4000') && status >= 400) failedResponses.push(`${status} ${url}`);
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):4000\/.*/, async route => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();
    const json = async (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (pathname === '/auth/login' && method === 'POST') {
      await json({ token: 'executive-token', user, agentRep });
      return;
    }

    if (pathname === '/auth/session') {
      await json({ user, agentRep });
      return;
    }

    if (pathname === '/commercial-command-center/dashboard') {
      await json({
        revenueLines: [{
          id: 'line-online-course',
          revenueLineType: 'online_course',
          name: 'Online Courses',
          description: 'Plan course launches and enrollment funnels.',
          status: 'active',
          configured: true,
          planCount: 1,
          openSignalCount: 0,
        }],
        stageSummary: { assess: 0, strategy_planning: 1, implementation_engagement: 0 },
        planSummary: { total: 1, active: 1, draft: 0, linkedToEvents: 1 },
        signalSummary: { open: 0, critical: 0, risk: 0 },
        recentPlans: [],
        openSignals: [],
        eventBridge: { activeEvents: 1, planningEvents: 0, completedEvents: 0, eventSectionPath: '/events' },
        stitchi: { supported: true, suggestedPrompt: 'Ask Stitchi.' },
      });
      return;
    }

    if (pathname === '/commercial-command-center/revenue-lines/live_event/dashboard' || pathname === '/commercial-command-center/revenue-lines/online_course/dashboard') {
      await json({
        revenueLine: {
          id: 'line-online-course',
          revenueLineType: 'online_course',
          name: 'Online Courses',
          description: 'Plan course launches and enrollment funnels.',
          status: 'active',
          configured: true,
          planCount: 1,
          openSignalCount: 0,
        },
        rollups: {
          plannedRevenueTarget: 30000,
          knownRevenue: 12000,
          plannedBudget: 5000,
          knownSpend: 3500,
          leads: 60,
          purchases: 8,
        },
        dataStatus: { hasLinkedEvents: true, hasKpiRecords: true, hasLeadRecords: true, missingDataSources: [] },
        plans: [],
        linkedEvents: [],
        availableEvents: [],
        openSignals: [],
        nextAction: { label: 'Open CEO Dashboard', description: 'Review executive reporting.', path: '/executive' },
      });
      return;
    }

    if (pathname === '/commercial-executive/dashboard') {
      await json(executiveDashboard(reportCreated, scheduleCreated));
      return;
    }

    if (pathname === '/commercial-executive/reports/preview' && method === 'POST') {
      reportCreated = true;
      await json({
        id: 'report-1',
        cadence: 'weekly',
        status: 'preview',
        title: 'Weekly commercial executive report',
        confidence: 'high',
        createdAt: '2026-07-08T12:00:00.000Z',
      }, 201);
      return;
    }

    if (pathname === '/commercial-executive/schedules' && method === 'POST') {
      scheduleCreated = true;
      await json({
        id: 'schedule-1',
        cadence: 'weekly',
        deliveryChannels: ['dashboard'],
        status: 'active',
        approvalRequired: true,
        createdAt: '2026-07-08T12:00:00.000Z',
      }, 201);
      return;
    }

    if (pathname === '/auth/logout') {
      await json({ ok: true });
      return;
    }

    unexpectedRequests.push(`${method} ${pathname}`);
    await json({ error: `Unexpected test request: ${method} ${pathname}` }, 500);
  });

  return {
    assertClean() {
      expect(unexpectedRequests, 'Executive dashboard should not call unrelated APIs').toEqual([]);
      expect(failedResponses, 'Executive dashboard should not have failed API responses').toEqual([]);
      expect(consoleErrors, 'Executive dashboard should not log browser errors').toEqual([]);
    },
  };
}

test.describe('SRD-R7 CEO commercial analytics', () => {
  test('commercial manager can view executive analytics and create report preview without external sending', async ({ page }) => {
    const monitor = await installExecutiveMocks(page);

    await page.setViewportSize({ width: 1800, height: 1100 });
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: 'Open Command Center' }).click();
    await page.waitForURL(/\/command-center(?:$|[?#])/);

    await page.getByRole('link', { name: /Executive Dashboard/i }).click();
    await expect(page).toHaveURL(/\/executive(?:$|[?#])/);
    await expect(page.getByRole('heading', { name: /^Executive Dashboard$/i })).toBeVisible();
    await expect(page.getByText('Revenue target', { exact: true })).toBeVisible();
    await expect(page.getByText('Known revenue', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('No-show rate needs attention')).toBeVisible();
    await expect(page.getByRole('table', { name: 'Revenue by active product' }).getByText('Online Courses', { exact: true })).toBeVisible();
    await expect(page.getByText('KPI records', { exact: true })).toBeVisible();
    await expect(page.getByText('Connect analytics or import KPI data')).toHaveCount(0);

    await page.getByRole('button', { name: 'Generate preview' }).click();
    await expect(page.getByText('Report preview created. No email or WhatsApp message was sent.')).toBeVisible();
    await expect(page.getByText('Weekly commercial executive report').last()).toBeVisible();

    await page.getByRole('button', { name: 'Save schedule' }).click();
    await expect(page.getByText(/Executive report workflow saved/i)).toBeVisible();
    await expect(page.getByText('Active schedules')).toBeVisible();

    monitor.assertClean();
  });
});
