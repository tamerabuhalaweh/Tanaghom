import { expect, test, type Page } from '@playwright/test';

type Role = 'department_head' | 'admin';

const people = {
  department_head: {
    id: 'commercial-manager',
    email: 'commercial.manager@tanaghum.com',
    name: 'Commercial Manager',
    role: 'department_head',
    tenantKey: 'default',
  },
  admin: {
    id: 'workspace-admin',
    email: 'admin@tanaghum.com',
    name: 'Workspace Admin',
    role: 'admin',
    tenantKey: 'default',
  },
};

const event = {
  id: 'event-leadership',
  name: 'Leadership Masterclass',
  eventDate: '2026-09-15T12:00:00.000Z',
  status: 'planning',
  linkedPlanCount: 1,
};

const revenueLine = {
  id: 'line-live-events',
  revenueLineType: 'live_event',
  name: 'Live Events',
  description: 'Commercial planning for live products and event handoff.',
  status: 'active',
  availability: 'active',
  configured: true,
  planCount: 1,
  openSignalCount: 1,
};

const plan = {
  id: 'plan-leadership',
  revenueLineId: revenueLine.id,
  linkedEventId: event.id,
  linkedEventName: event.name,
  title: 'Leadership Masterclass Growth Plan',
  horizon: 'quarterly',
  stage: 'strategy_planning',
  status: 'active',
  currency: 'USD',
  objective: 'Convert warm followers into qualified buyers.',
  audience: 'Entrepreneurs and previous customers.',
  budgetTarget: 5000,
  revenueTarget: 30000,
  strategySummary: 'Use proof-led content and governed follow-up.',
  actionPlan: 'Prepare content, ads, CRM follow-up, and buyer reminders.',
};

function commercialDashboard() {
  return {
    revenueLines: [revenueLine, {
      id: 'line-online-course',
      revenueLineType: 'online_course',
      name: 'Online Courses',
      status: 'not_configured',
      availability: 'future',
      configured: false,
      planCount: 0,
      openSignalCount: 0,
    }],
    stageSummary: { assess: 1, strategy_planning: 1, implementation_engagement: 0 },
    rollups: { plannedRevenueTarget: 30000, knownRevenue: 12000, knownSpend: 2100, leads: 96, purchases: 12 },
  };
}

function lineDashboard(plans = [plan]) {
  return {
    revenueLine,
    rollups: {
      currency: 'USD',
      plannedRevenueTarget: 30000,
      plannedBudget: 5000,
      knownRevenue: 12000,
      knownSpend: 2100,
      leads: 96,
      purchases: 12,
      meetingsBooked: 18,
      noShows: 2,
      leadToPurchaseRate: 12.5,
      costPerLead: 21.88,
    },
    dataStatus: {
      hasLinkedEvents: true,
      hasKpiRecords: true,
      hasLeadRecords: true,
      missingDataSources: ['Customer CRM purchase sync'],
    },
    plans,
    linkedEvents: [event],
    availableEvents: [event],
    openSignals: [{
      id: 'signal-crm',
      title: 'Purchase attribution needs CRM data',
      severity: 'warning',
      recommendedAction: 'Validate the customer-owned CRM connection before the executive report.',
    }],
    nextAction: {
      label: 'Confirm the launch plan owners',
      description: 'Assign owners to content, ads, CRM follow-up, and buyer reminders.',
      path: '/stitchi',
    },
  };
}

const workspaces = [{
  id: 'brand_positioning',
  label: 'Brand & Positioning',
  purpose: 'Shape the promise, message, and market position.',
  categories: ['research_note', 'positioning_decision'],
  recordCount: 1,
  blockedCount: 0,
  records: [{
    id: 'record-promise',
    discipline: 'brand_positioning',
    category: 'positioning_decision',
    title: 'Leadership promise for warm buyers',
    summary: 'Lead with practical transformation and credible proof.',
    details: 'Use alumni outcomes and one clear buyer next step.',
    priority: 'high',
    status: 'active',
    revenueLineId: revenueLine.id,
    revenueLineName: revenueLine.name,
    commercialPlanId: plan.id,
    commercialPlanTitle: plan.title,
  }],
}, {
  id: 'acquisition',
  label: 'Acquisition',
  purpose: 'Plan audiences, channels, and demand generation.',
  categories: ['campaign_brief'],
  recordCount: 0,
  blockedCount: 0,
  records: [],
}, {
  id: 'conversion_closing',
  label: 'Conversion & Closing',
  purpose: 'Improve offers, sales conversations, and close rates.',
  categories: ['objection_script'],
  recordCount: 0,
  blockedCount: 0,
  records: [],
}, {
  id: 'growth_retention',
  label: 'Growth & Retention',
  purpose: 'Build upsell, retention, and customer value work.',
  categories: ['retention_plan'],
  recordCount: 0,
  blockedCount: 0,
  records: [],
}, {
  id: 'commercial_operations',
  label: 'Commercial Operations',
  purpose: 'Coordinate owners, blockers, and operating discipline.',
  categories: ['operating_task'],
  recordCount: 0,
  blockedCount: 0,
  records: [],
}];

function executiveDashboard() {
  return {
    defaultCurrency: 'AED',
    currency: 'USD',
    currencyBreakdown: [{ currency: 'USD', plannedRevenueTarget: 30000, plannedBudget: 5000, knownRevenue: 12000, knownSpend: 2100, planCount: 1 }],
    ambiguousCurrencyRecordCount: 0,
    confidence: 'medium',
    metrics: {
      currency: 'USD',
      knownRevenue: 12000,
      plannedRevenueTarget: 30000,
      knownSpend: 2100,
      leads: 96,
      purchases: 12,
    },
    connectorReadiness: { synced: 1, readyForSync: 2 },
    disciplineSummary: { blocked: 0 },
    alerts: [{
      code: 'crm_attribution',
      title: 'CRM purchase attribution needs validation',
      detail: 'Purchase totals are internal until the customer CRM is validated.',
      recommendedAction: 'Complete the customer credential acceptance run.',
      severity: 'watch',
    }],
    missingSources: ['Customer CRM purchase sync', 'Meta Ads analytics'],
    revenueLines: [{
      type: 'live_event',
      name: 'Live Events',
      plannedRevenueTarget: 30000,
      knownRevenue: 12000,
      knownSpend: 2100,
      leads: 96,
      purchases: 12,
      currency: 'USD',
    }],
    channelPerformance: [{ channel: 'email', reach: 3200, leads: 44, purchases: 8, spend: 500, costPerLead: 11.36, currency: 'USD' }],
    dataFreshness: [{ source: 'Internal commercial records', detail: 'Current plan and lead records.', lastSeenAt: '2026-07-10T09:00:00.000Z', status: 'current' }],
    reports: {
      recent: [],
      activeSchedules: [],
      workflow: {
        deliveryReadiness: [
          { channel: 'dashboard', status: 'ready', detail: 'Dashboard previews are available.' },
          { channel: 'email', status: 'setup_required', detail: 'Customer email delivery is not configured.' },
        ],
      },
    },
  };
}

async function installMocks(page: Page, role: Role) {
  let currentPlans = [plan];
  let currentWorkspaces = structuredClone(workspaces);
  const failedResponses: string[] = [];
  const browserErrors: string[] = [];
  const unexpectedRequests: string[] = [];

  await page.addInitScript(() => window.localStorage.setItem('token', 'ux-r1d1-token'));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.url().includes(':4000') && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):4000\/.*/, async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/session') return json({ user: people[role], agentRep: { id: `profile-${role}`, name: people[role].name, status: 'active' } });
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/commercial-command-center/dashboard') return json(commercialDashboard());
    if (path === '/commercial-command-center/revenue-lines/live_event/dashboard') return json(lineDashboard(currentPlans));
    if (path === '/commercial-command-center/revenue-lines') return json([revenueLine]);
    if (path === '/commercial-command-center/plans' && method === 'GET') return json(currentPlans);
    if (path === '/commercial-command-center/plans' && method === 'POST') {
      const payload = request.postDataJSON();
      const created = { ...plan, ...payload, id: 'plan-created' };
      currentPlans = [...currentPlans, created];
      return json(created, 201);
    }
    if (path === '/commercial-disciplines/workspaces') return json(currentWorkspaces);
    if (path === '/commercial-disciplines/records' && method === 'POST') {
      const payload = request.postDataJSON();
      const created = { ...payload, id: 'record-created', revenueLineName: revenueLine.name };
      currentWorkspaces = currentWorkspaces.map(workspace => workspace.id === payload.discipline
        ? { ...workspace, recordCount: workspace.recordCount + 1, records: [...workspace.records, created] }
        : workspace);
      return json(created, 201);
    }
    if (path === '/commercial-executive/dashboard') return json(executiveDashboard());

    unexpectedRequests.push(`${method} ${path}`);
    return json({ error: `Unexpected UX-R1D1 request: ${method} ${path}` }, 500);
  });

  return {
    assertClean() {
      expect(unexpectedRequests, 'UX-R1D1 must not call unrelated or unauthorized APIs').toEqual([]);
      expect(failedResponses, 'UX-R1D1 must not receive failed API responses').toEqual([]);
      expect(browserErrors, 'UX-R1D1 must not log browser errors').toEqual([]);
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function captureApprovedSurface(page: Page, name: string) {
  if (process.env.UX_CAPTURE !== '1') return;
  await page.screenshot({ path: `docs/ux/ux-r1d1/${name}.png`, fullPage: true });
}

test.describe('UX-R1D1 production commercial workspaces', () => {
  test('commercial manager can create a plan and a linked discipline work item', async ({ page }) => {
    const monitor = await installMocks(page, 'department_head');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/commercial-plans');

    await expect(page.getByRole('heading', { name: 'Execution Plans' })).toBeVisible();
    const commercialNav = page.getByRole('navigation', { name: 'Commercial planning workspace' });
    await expect(commercialNav).toBeVisible();
    await expect(page.getByRole('link', { name: 'Executive Dashboard' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Workspace Admin' })).toHaveCount(0);
    await expect(page.getByText(/\b(Sprint|Acceptance|STITCH|SAIF|MCP|M5)\b/i)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
    await captureApprovedSurface(page, 'production-commercial-plans-desktop');

    await page.getByText('Need an unplanned exception?').click();
    await page.getByRole('button', { name: 'Create standalone exception' }).click();
    await page.getByLabel('Plan title').fill('Autumn Leadership Launch');
    await page.getByLabel('Linked event').selectOption(event.id);
    await page.getByLabel('Status').selectOption('active');
    await page.getByLabel('Budget target').fill('7000');
    await page.getByLabel('Revenue target').fill('42000');
    await page
      .getByLabel('Standalone exception reason')
      .fill('A time-sensitive launch was approved outside the current annual portfolio.');
    await page.getByLabel('Objective').fill('Convert warm followers into leadership course buyers.');
    await page.getByLabel('Audience').fill('Warm followers and previous customers.');
    await page.getByLabel('Action plan').fill('Prepare content, paid acquisition, CRM follow-up, and reminders.');
    await page.getByRole('button', { name: 'Create standalone exception' }).last().click();
    await expect(
      page.getByText('Standalone execution plan created with its exception reason recorded.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Autumn Leadership Launch/i })).toBeVisible();

    await commercialNav.getByRole('link', { name: /Discipline Workspaces/i }).click();
    await expect(page.getByRole('heading', { name: 'Discipline Workspaces' })).toBeVisible();
    await page.getByLabel('Title').fill('Buyer objection response');
    await page.getByLabel('Summary').fill('Answer the timing and value objections for warm buyers.');
    await page.getByLabel('Revenue line').selectOption(revenueLine.id);
    await page.getByRole('combobox', { name: /^Commercial plan/ }).selectOption(plan.id);
    await page.getByRole('button', { name: 'Create work item' }).click();
    await expect(page.getByText('Workspace record created.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Buyer objection response/i }).last()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureApprovedSurface(page, 'production-discipline-workspaces-desktop');
    monitor.assertClean();
  });

  test('mobile commercial plan keeps the task and workspace handoff usable', async ({ page }) => {
    const monitor = await installMocks(page, 'department_head');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/commercial-plans');

    await expect(page.getByRole('heading', { name: 'Execution Plans' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile product navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Event Operations' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureApprovedSurface(page, 'production-commercial-plans-mobile');

    await page.setViewportSize({ width: 768, height: 900 });
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Product navigation' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    monitor.assertClean();
  });

  test('executive role sees decision and reporting view without customer data invention', async ({ page }) => {
    const monitor = await installMocks(page, 'admin');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/executive');

    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Executive Dashboard' })).toBeVisible();
    await expect(page.getByLabel('Executive commercial summary').getByText('$12,000')).toBeVisible();
    await expect(page.getByText('CRM purchase attribution needs validation')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Executive report workflow' })).toBeVisible();
    await expect(page.getByText('Customer CRM purchase sync')).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await captureApprovedSurface(page, 'production-executive-dashboard-desktop');

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    monitor.assertClean();
  });
});
