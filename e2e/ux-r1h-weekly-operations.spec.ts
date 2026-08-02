import { expect, test, type Page } from '@playwright/test';

type Role = 'marketing_manager' | 'specialist' | 'cco';

const planId = '00000000-0000-0000-0000-000000000940';
const ownerId = '00000000-0000-0000-0000-000000000942';
const itemId = '00000000-0000-0000-0000-000000000941';

const people = {
  marketing_manager: { id: 'manager-1', name: 'Commercial Manager', email: 'manager@customer.test', role: 'marketing_manager', tenantKey: 'default' },
  specialist: { id: ownerId, name: 'Sara Specialist', email: 'sara@customer.test', role: 'specialist', tenantKey: 'default' },
  cco: { id: 'cco-1', name: 'Commercial CCO', email: 'cco@customer.test', role: 'cco', tenantKey: 'default' },
};

const revenueLine = {
  id: '00000000-0000-0000-0000-000000000950',
  revenueLineType: 'live_event',
  name: 'Live Events',
  description: 'Operate live-event revenue and delivery.',
  status: 'active',
  configured: true,
  planCount: 1,
  openSignalCount: 0,
};

const plan = {
  id: planId,
  revenueLineId: revenueLine.id,
  title: 'Leadership event execution plan',
  stage: 'implementation_engagement',
  status: 'active',
  objective: 'Fill the event with qualified entrepreneurs.',
  audience: 'Warm followers and previous buyers.',
  budgetTarget: 50000,
  revenueTarget: 250000,
  currency: 'AED',
  origin: 'annual_month',
  annualPlanTitle: '2026 Commercial Growth Plan',
  annualPlanYear: 2026,
  monthlyPortfolioTitle: 'August leadership event',
  monthlyPortfolioMonth: 8,
};

function weeklyItem(status: string, createdByUserId = 'manager-1') {
  return {
    id: itemId,
    commercialPlanId: planId,
    weekStartDate: '2026-08-03',
    weekEndDate: '2026-08-09',
    title: 'Approve campaign brief',
    businessOutcome: 'Release the campaign before media booking closes.',
    ownerUserId: ownerId,
    ownerName: 'Sara Specialist',
    ownerRole: 'specialist',
    startDate: '2026-08-03',
    dueDate: '2026-08-05',
    status,
    priority: 'high',
    budgetGuardrail: 3000,
    currency: 'AED',
    linkType: null,
    linkObjectId: null,
    linkLabel: null,
    blockerReason: null,
    completionEvidence: null,
    revision: 1,
    createdByUserId,
  };
}

async function installMocks(page: Page, role: Role, initialStatus?: string, failWorkspace = false) {
  let items = initialStatus ? [weeklyItem(initialStatus)] : [];
  const unexpected: string[] = [];
  const browserProblems: string[] = [];
  const failedResponses: string[] = [];

  await page.addInitScript(() => window.localStorage.setItem('token', 'weekly-operations-token'));
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => browserProblems.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (!failWorkspace && response.url().includes(':4000') && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.route('**/*', async route => {
    const request = route.request();
    if (request.resourceType() === 'document') return route.continue();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/session') return json({ user: people[role], agentRep: { id: `profile-${role}`, name: people[role].name, status: 'active' } });
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/commercial-command-center/dashboard') return json({
      defaultCurrency: 'AED',
      revenueLines: [revenueLine],
      stageSummary: { assess: 0, strategy_planning: 0, implementation_engagement: 1 },
      rollups: { plannedRevenueTarget: 250000, knownRevenue: 0, knownSpend: 0, leads: 0, purchases: 0 },
    });
    if (path === '/commercial-command-center/revenue-lines/live_event/dashboard') return json({
      defaultCurrency: 'AED',
      revenueLine,
      rollups: { plannedRevenueTarget: 250000, knownRevenue: 0, knownSpend: 0, leads: 0, purchases: 0 },
      dataStatus: { hasLinkedEvents: false, hasKpiRecords: false, hasLeadRecords: false, missingDataSources: [] },
      plans: [plan],
      linkedEvents: [],
      availableEvents: [],
      openSignals: [],
      approvedLearning: [],
      nextAction: { label: 'Run this week', description: 'Turn the execution plan into owned weekly work.', path: '/commercial-plans' },
    });
    if (path === `/commercial-plans/${planId}/weeks` && method === 'GET') {
      if (failWorkspace) return json({ error: 'Weekly operations are temporarily unavailable.' }, 500);
      return json({
        timezone: 'Asia/Dubai',
        selectedWeek: { startDate: '2026-08-03', endDate: '2026-08-09', label: '3-9 August 2026' },
        plan: {
          id: planId,
          title: plan.title,
          status: 'active',
          currency: 'AED',
          budgetTarget: 50000,
          revenueTarget: 250000,
          revenueLineName: 'Live Events',
          annualPlanId: 'annual-1',
          annualPlanTitle: '2026 Commercial Growth Plan',
          annualPlanYear: 2026,
          monthlyPortfolioItemId: 'month-1',
          monthlyPortfolioTitle: 'August leadership event',
          monthlyPortfolioMonth: 8,
          periodStartDate: '2026-08-01',
          periodEndDate: '2026-08-31',
        },
        rollup: {
          itemCount: items.length,
          completedCount: items.filter(item => item.status === 'completed').length,
          blockedCount: items.filter(item => item.status === 'blocked').length,
          awaitingApprovalCount: items.filter(item => item.status === 'awaiting_approval').length,
          budgetGuardrail: items.reduce((sum, item) => sum + Number(item.budgetGuardrail || 0), 0),
          remainingPlanBudget: 50000 - items.reduce((sum, item) => sum + Number(item.budgetGuardrail || 0), 0),
        },
        owners: [{ id: ownerId, name: 'Sara Specialist', role: 'specialist' }],
        linkOptions: [],
        items,
      });
    }
    if (path === `/commercial-plans/${planId}/weeks/items` && method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      const created = { ...weeklyItem('planned'), ...payload, id: itemId, revision: 1, ownerName: 'Sara Specialist', createdByUserId: people[role].id };
      items = [created];
      return json(created, 201);
    }
    if (path === `/commercial-plans/${planId}/weeks/items/${itemId}/transition` && method === 'POST') {
      const payload = request.postDataJSON() as { targetStatus: string; blockerReason?: string; completionEvidence?: string };
      items = items.map(item => item.id === itemId ? {
        ...item,
        status: payload.targetStatus,
        blockerReason: payload.blockerReason || null,
        completionEvidence: payload.completionEvidence || null,
        revision: item.revision + 1,
      } : item);
      return json(items[0]);
    }

    if (url.origin === 'http://127.0.0.1:3000' || url.origin === 'http://localhost:3000') return route.continue();
    unexpected.push(`${method} ${path}${url.search}`);
    return json({ error: `Unexpected weekly-operation request: ${method} ${path}` }, 500);
  });

  return {
    assertClean() {
      expect(unexpected).toEqual([]);
      expect(failedResponses).toEqual([]);
      expect(browserProblems).toEqual([]);
    },
  };
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectNoSectionHeaderOverlap(page: Page) {
  const overlaps = await page.locator('.commercial-r1d-page .ops-section-header').evaluateAll(headers => headers.flatMap((header, index) => {
    const children = Array.from(header.children).filter(child => {
      const style = window.getComputedStyle(child);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    if (children.length < 2) return [];
    const first = children[0].getBoundingClientRect();
    const second = children[1].getBoundingClientRect();
    const intersects = first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    return intersects ? [{ index, first: children[0].textContent, second: children[1].textContent }] : [];
  }));
  expect(overlaps).toEqual([]);
}

async function capture(page: Page, name: string, fullPage = true) {
  if (process.env.UX_CAPTURE !== '1') return;
  await page.screenshot({ path: `docs/ux/ux-r1h/${name}.png`, fullPage });
}

test.describe('UX-R1H weekly operating cadence', () => {
  test('manager creates owned weekly work with keyboard-operable controls', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/commercial-plans?planId=${planId}`);

    await expect(page.getByRole('heading', { name: 'Weekly operations' })).toBeVisible();
    await expect(page.getByText('No weekly work planned')).toBeVisible();
    const addButton = page.getByRole('button', { name: 'Add weekly work' }).first();
    await addButton.focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('Work title').fill('Approve campaign brief');
    await page.getByLabel('Owner').selectOption(ownerId);
    await page.getByLabel('Start date').fill('2026-08-03');
    await page.getByLabel('Due date').fill('2026-08-05');
    await page.getByLabel('Priority').selectOption('high');
    await page.getByLabel('Budget guardrail (AED)').fill('3000');
    await page.getByLabel('Business outcome').fill('Release the campaign before media booking closes.');
    await page.getByRole('button', { name: 'Add to week' }).click();

    await expect(page.getByText('Weekly work added to this execution plan.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Approve campaign brief/ })).toBeVisible();
    await capture(page, 'weekly-manager-desktop');
    await expectNoOverflow(page);
    monitor.assertClean();
  });

  test('assigned specialist updates only their weekly work', async ({ page }) => {
    const monitor = await installMocks(page, 'specialist', 'ready');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/commercial-plans?planId=${planId}`);

    await expect(page.getByRole('button', { name: 'Add weekly work' })).toHaveCount(0);
    await page.getByLabel('Next status').selectOption('in_progress');
    await page.getByRole('button', { name: 'Save status' }).click();
    await expect(page.getByText('Weekly work moved to in progress.')).toBeVisible();
    await capture(page, 'weekly-specialist-mobile', false);
    await expectNoOverflow(page);
    await expectNoSectionHeaderOverlap(page);
    monitor.assertClean();
  });

  test('CCO approves submitted work without self-approval', async ({ page }) => {
    const monitor = await installMocks(page, 'cco', 'awaiting_approval');
    await page.goto(`/commercial-plans?planId=${planId}`);

    await expect(page.getByText('CCO decision required')).toBeVisible();
    await page.getByRole('button', { name: 'Approve work' }).click();
    await expect(page.getByText('Weekly work approved and ready for the team.')).toBeVisible();
    await capture(page, 'weekly-cco-approval-desktop');
    await expectNoOverflow(page);
    monitor.assertClean();
  });

  test('mobile layout has no overflow and exposes an honest load failure', async ({ page }) => {
    await installMocks(page, 'marketing_manager', undefined, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/commercial-plans?planId=${planId}`);

    await expect(page.getByText('Weekly operations are temporarily unavailable.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();
    await expectNoOverflow(page);
  });
});
