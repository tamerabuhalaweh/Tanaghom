import { expect, test, type Page } from '@playwright/test';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'commercial.lead@customer.test',
  name: 'Commercial Department Head',
  role: 'cco',
  tenantKey: 'default',
};

const annualPlanId = '22222222-2222-4222-8222-222222222222';
const learningSetId = '33333333-3333-4333-8333-333333333333';
const revenueLineId = '44444444-4444-4444-8444-444444444444';
const detailedPlanId = '55555555-5555-4555-8555-555555555555';
const eventId = '66666666-6666-4666-8666-666666666666';
const itemId = '77777777-7777-4777-8777-777777777777';
const allocationId = '88888888-8888-4888-8888-888888888888';

const revenueLine = {
  id: revenueLineId,
  revenueLineType: 'online_course',
  name: 'Online Courses',
  status: 'active',
  configured: true,
  planCount: 1,
  openSignalCount: 0,
};

const detailedPlan = {
  id: detailedPlanId,
  revenueLineId,
  linkedEventId: eventId,
  linkedEventName: 'Leadership Masterclass',
  title: 'Leadership Course Execution Plan',
  horizon: 'product_or_event',
  stage: 'strategy_planning',
  status: 'draft',
  currency: 'AED',
  objective: 'Convert warm followers into course buyers.',
  audience: 'Entrepreneurs and previous buyers.',
  budgetTarget: 50000,
  revenueTarget: 250000,
  strategySummary: 'Use approved historical learning and seasonal timing.',
  actionPlan: 'Prepare content, acquisition, CRM follow-up, and buyer reminders.',
};

const linkedEvent = {
  id: eventId,
  name: 'Leadership Masterclass',
  eventDate: '2027-03-20T12:00:00.000Z',
  status: 'planning',
};

function rollup(items: Record<string, unknown>[]) {
  const budget = items.reduce((total, item) => total + Number(item.budgetAllocation || 0), 0);
  const revenue = items.reduce((total, item) => total + Number(item.revenueTarget || 0), 0);
  return {
    planCurrency: 'AED',
    annualBudgetTarget: 500000,
    annualRevenueTarget: 2500000,
    allocatedBudget: budget,
    allocatedRevenueTarget: revenue,
    unallocatedBudget: 500000 - budget,
    overAllocated: budget > 500000,
    readiness: { planned: items.length, needs_brief: 0, ready: 0, blocked: 0, completed: 0 },
    currencies: [
      {
        currency: 'AED',
        budgetAllocation: budget,
        revenueTarget: revenue,
        itemCount: items.length,
      },
    ],
    months: Array.from({ length: 12 }, (_, index) => ({
      month: index + 1,
      itemCount: items.filter((item) => Number(item.month) === index + 1).length,
      readiness: {
        planned: items.filter((item) => Number(item.month) === index + 1).length,
        needs_brief: 0,
        ready: 0,
        blocked: 0,
        completed: 0,
      },
      currencies: [],
    })),
  };
}

function makeItem(linked = true) {
  return {
    id: itemId,
    month: 3,
    sortOrder: 0,
    title: 'Ramadan Leadership Course',
    plannedStartDate: '2027-03-01T00:00:00.000Z',
    plannedEndDate: '2027-03-20T00:00:00.000Z',
    currency: 'AED',
    budgetAllocation: 50000,
    revenueTarget: 250000,
    priority: 'high',
    readiness: 'planned',
    revenueLine: {
      id: revenueLineId,
      name: 'Online Courses',
      type: 'online_course',
      status: 'active',
    },
    commercialPlan: linked ? {
      id: detailedPlanId,
      title: detailedPlan.title,
      status: 'draft',
      horizon: 'product_or_event',
    } : null,
    event: {
      id: eventId,
      name: linkedEvent.name,
      eventDate: linkedEvent.eventDate,
      status: 'planning',
    },
    owner: null,
  };
}

function makeAnnualPlan(status = 'draft', revision = 1, items: Record<string, unknown>[] = []) {
  return {
    id: annualPlanId,
    year: 2027,
    scenarioVersion: 1,
    revision,
    title: '2027 Commercial Growth Portfolio',
    strategy: 'Scale proven course and event motions around seasonal buying periods.',
    currency: 'AED',
    budgetTarget: 500000,
    revenueTarget: 2500000,
    status,
    items,
    learningSets: [
      {
        id: learningSetId,
        title: '2026 Approved Commercial Learning',
        status: 'active',
        findings: [
          { id: 'finding-1', title: 'Repeat warm-audience launch sequence', confidence: 0.86 },
        ],
      },
    ],
    rollup: rollup(items),
  };
}

function makeBudgetSummary(
  currentPlan: ReturnType<typeof makeAnnualPlan>,
  budgetAllocation: Record<string, unknown> | null,
) {
  const items = currentPlan.items as Array<Record<string, unknown>>;
  const allocations = budgetAllocation ? [budgetAllocation] : [];
  const allocated = budgetAllocation ? Number(budgetAllocation.amount) : 0;
  return {
    annualPlan: {
      id: annualPlanId,
      title: currentPlan.title,
      year: currentPlan.year,
      status: currentPlan.status,
      currency: currentPlan.currency,
      budgetTarget: currentPlan.budgetTarget,
    },
    currencies: [{
      currency: 'AED',
      annualEnvelope: currentPlan.budgetTarget,
      allocated,
      approved: 0,
      committed: 0,
      verifiedActual: 0,
      remaining: Number(currentPlan.budgetTarget) - allocated,
      variance: Number(currentPlan.budgetTarget),
      overAllocated: false,
      envelopeMissing: false,
    }],
    allocations,
    monthlyItems: items.map(item => ({
      id: item.id,
      month: item.month,
      title: item.title,
      revenueLineId,
      revenueLineName: 'Online Courses',
      currency: item.currency,
      requestedTarget: item.budgetAllocation,
      allocationId: budgetAllocation ? allocationId : null,
      governedAllocation: budgetAllocation ? budgetAllocation.amount : 0,
      status: budgetAllocation ? budgetAllocation.status : null,
    })),
    availableTargets: items.length ? [{
      level: 'commercial_plan',
      id: detailedPlanId,
      label: detailedPlan.title,
      parentTargetId: itemId,
    }] : [],
    evidence: {
      verifiedCount: 0,
      unverifiedCount: 0,
      rejectedCount: 0,
      sourceMissing: true,
      records: [],
    },
    permissions: { canManage: true, canApprove: true, canVerifyEvidence: true },
  };
}

function makeHierarchy(learningLinked = false) {
  return {
    ...detailedPlan,
    hierarchy_assignment: {
      annual_plan: { id: annualPlanId, year: 2027, title: '2027 Commercial Growth Portfolio' },
      monthly_item: { id: itemId, month: 3, title: 'Ramadan Leadership Course' },
    },
    activeEventLinks: [
      { id: 'event-link-1', event: { ...linkedEvent, name: linkedEvent.name } },
    ],
    activeCampaignLinks: [],
    activeLearningInfluences: learningLinked
      ? [{
          id: 'learning-link-1',
          finding: {
            id: 'finding-1',
            title: 'Repeat warm-audience launch sequence',
            recommendation: 'Reuse the proven warm-audience launch sequence.',
          },
        }]
      : [],
    outcomes: { leads: 12, purchases: 3, knownRevenue: 75000, contentItems: 4 },
  };
}

async function installMocks(page: Page, seeded = false, role = user.role) {
  const sessionUser = {
    ...user,
    role,
    name: role === 'specialist' ? 'Commercial Specialist' : user.name,
  };
  let currentPlan: ReturnType<typeof makeAnnualPlan> | null = seeded
    ? makeAnnualPlan('draft', 2, [makeItem()])
    : null;
  let learningLinked = false;
  let budgetAllocation: Record<string, unknown> | null = null;
  const failedResponses: string[] = [];
  const browserProblems: string[] = [];
  const unexpectedRequests: string[] = [];

  await page.addInitScript(() =>
    window.localStorage.setItem('token', 'annual-planning-acceptance-token'),
  );
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning')
      browserProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes(':4000') && response.status() >= 400)
      failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await page.route(/http:\/\/(127\.0\.0\.1|localhost):4000\/.*/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/auth/session')
      return json({
        user: sessionUser,
        agentRep: { id: 'profile-1', name: sessionUser.name, status: 'active' },
      });
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/annual-commercial-plans' && method === 'GET')
      return json(currentPlan ? [currentPlan] : []);
    if (path === '/annual-commercial-plans' && method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      currentPlan = {
        ...makeAnnualPlan(),
        ...payload,
        learningSets: makeAnnualPlan().learningSets,
      };
      return json(currentPlan, 201);
    }
    if (path === `/annual-commercial-plans/${annualPlanId}/items` && method === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>;
      expect(payload).toMatchObject({
        expectedRevision: 1,
        month: 3,
        revenueLineId,
        eventId,
        currency: 'AED',
        budgetAllocation: 50000,
        revenueTarget: 250000,
      });
      expect(payload).toHaveProperty('commercialPlanId', null);
      currentPlan = makeAnnualPlan('draft', 2, [makeItem(false)]);
      return json(currentPlan);
    }
    if (
      path === `/annual-commercial-plans/${annualPlanId}/items/${itemId}/execution-plan` &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      expect(payload).toMatchObject({
        expectedRevision: 2,
        title: 'Leadership Course Execution Plan',
        objective: 'Convert warm followers into course buyers.',
        audience: 'Entrepreneurs and previous buyers.',
      });
      currentPlan = makeAnnualPlan('draft', 3, [makeItem(true)]);
      return json({
        annualPlan: currentPlan,
        executionPlan: {
          id: detailedPlanId,
          title: detailedPlan.title,
          origin: 'annual_month',
          annualPlanId,
          monthlyPortfolioItemId: itemId,
        },
      }, 201);
    }
    if (path === `/annual-commercial-plans/${annualPlanId}/submit` && method === 'POST') {
      currentPlan = makeAnnualPlan('pending_approval', 4, [makeItem()]);
      return json(currentPlan);
    }
    if (path === `/annual-commercial-plans/${annualPlanId}/approve` && method === 'POST') {
      currentPlan = makeAnnualPlan('approved', 5, [makeItem()]);
      return json(currentPlan);
    }
    if (
      path === `/commercial-budget-reconciliation/annual-plans/${annualPlanId}` &&
      method === 'GET'
    ) {
      return json(makeBudgetSummary(currentPlan || makeAnnualPlan(), budgetAllocation));
    }
    if (
      path === `/commercial-budget-reconciliation/annual-plans/${annualPlanId}/allocations` &&
      method === 'POST'
    ) {
      const payload = request.postDataJSON() as Record<string, unknown>;
      expect(payload).toMatchObject({
        level: 'monthly_item',
        monthlyPortfolioItemId: itemId,
        currency: 'AED',
        amount: 50000,
        allowOverAllocation: false,
      });
      budgetAllocation = {
        id: allocationId,
        parentAllocationId: null,
        level: 'monthly_item',
        target: {
          id: itemId,
          label: 'Ramadan Leadership Course',
          month: 3,
          revenueLineId,
          revenueLineName: 'Online Courses',
        },
        currency: 'AED',
        amount: 50000,
        status: 'planned',
        revision: 1,
        reason: payload.reason,
        exceptionApproved: false,
        exceptionReason: null,
        verifiedActual: 0,
        remaining: 50000,
        variance: 50000,
        childAllocated: 0,
        childRemaining: 50000,
        children: [],
      };
      return json(makeBudgetSummary(currentPlan || makeAnnualPlan(), budgetAllocation), 201);
    }
    if (path === '/commercial-command-center/revenue-lines') return json([revenueLine]);
    if (path === '/commercial-command-center/plans') return json([detailedPlan]);
    if (path === '/events') return json([linkedEvent]);
    if (path === '/campaigns') return json([]);
    if (path === `/commercial-hierarchy/plans/${detailedPlanId}` && method === 'GET')
      return json(makeHierarchy(learningLinked));
    if (path === `/commercial-hierarchy/plans/${detailedPlanId}/learning` && method === 'POST') {
      learningLinked = true;
      return json(makeHierarchy(true));
    }
    if (path === '/commercial-assessments/learning-sets')
      return json([
        {
          id: learningSetId,
          title: '2026 Approved Commercial Learning',
          status: 'active',
          findings: [
            { id: 'finding-1', title: 'Repeat warm-audience launch sequence', confidence: 0.86 },
          ],
        },
      ]);
    if (path === '/commercial-command-center/dashboard') {
      return json({
        defaultCurrency: 'AED',
        revenueLines: [revenueLine],
        stageSummary: { strategy_planning: 1, implementation_engagement: 0 },
        rollups: { plannedRevenueTarget: 250000, plannedBudget: 50000 },
      });
    }
    if (path === '/commercial-command-center/revenue-lines/online_course/dashboard') {
      return json({
        defaultCurrency: 'AED',
        revenueLine,
        rollups: {
          currency: 'AED',
          plannedRevenueTarget: 250000,
          plannedBudget: 50000,
          knownRevenue: 0,
          knownSpend: 0,
        },
        dataStatus: {
          hasLinkedEvents: true,
          hasKpiRecords: false,
          hasLeadRecords: false,
          missingDataSources: ['Customer analytics connectors'],
        },
        plans: [detailedPlan],
        linkedEvents: [linkedEvent],
        availableEvents: [linkedEvent],
        openSignals: [],
        approvedLearning: [],
        nextAction: {
          label: 'Prepare execution work',
          description: 'Continue with the linked detailed plan.',
          path: '/commercial-plans',
        },
      });
    }

    unexpectedRequests.push(`${method} ${path}`);
    return json({ error: `Unexpected annual-planning request: ${method} ${path}` }, 500);
  });

  return {
    assertClean() {
      expect(unexpectedRequests, 'Annual planning must not call unrelated APIs').toEqual([]);
      expect(failedResponses, 'Annual planning must not receive failed API responses').toEqual([]);
      expect(browserProblems, 'Annual planning must not emit console errors or warnings').toEqual(
        [],
      );
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('SRD-R14B annual commercial planning', () => {
  test('commercial leader creates, allocates, drills down, and approves the annual portfolio', async ({
    page,
  }) => {
    const monitor = await installMocks(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/commercial-planning');

    await expect(page.getByRole('heading', { name: 'Annual Commercial Plan' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Annual Plan/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await page.getByLabel('Annual budget target').fill('500000');
    await page.getByLabel('Annual revenue target').fill('2500000');
    await page
      .getByLabel('Annual strategy')
      .fill('Scale proven course and event motions around seasonal buying periods.');
    await page.getByLabel(/2026 Approved Commercial Learning/).check();
    await page.getByRole('button', { name: 'Create annual plan' }).click();

    await expect(
      page.getByText(
        'Annual plan created. Add the monthly products and events that will deliver it.',
      ),
    ).toBeVisible();
    await expect(
      page.getByLabel('Annual plan totals').getByText('AED 500,000', { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText('Available for future months').first()).toBeVisible();

    await page.getByRole('button', { name: 'Add initiative' }).first().click();
    await page.locator('#portfolio-item-editor select').first().selectOption('3');
    await page.getByLabel('Revenue line').last().selectOption(revenueLineId);
    await page.getByLabel('Initiative title').fill('Ramadan Leadership Course');
    await page.getByLabel('Priority').selectOption('high');
    await page.getByLabel('Budget allocation').fill('50000');
    await page.getByLabel('Revenue target').last().fill('250000');
    await page.getByLabel('Start date').fill('2027-03-01');
    await page.getByLabel('End date').fill('2027-03-20');
    await page.getByLabel('Event Operations link').selectOption(eventId);
    await page.getByRole('button', { name: 'Save initiative' }).click();

    await expect(page.getByText('Monthly initiative added to the annual portfolio.')).toBeVisible();
    await expect(page.getByText('Ramadan Leadership Course', { exact: true }).first()).toBeVisible();
    await expect(page.getByLabel('Annual plan totals').getByText(/450,000/)).toBeVisible();

    await page.getByRole('button', { name: 'Create execution plan', exact: true }).click();
    await page.getByLabel('Execution plan title').fill('Leadership Course Execution Plan');
    await page.getByLabel('Objective').fill('Convert warm followers into course buyers.');
    await page.getByLabel('Audience').fill('Entrepreneurs and previous buyers.');
    await page
      .locator('#execution-plan-editor textarea')
      .nth(2)
      .fill('Use approved historical learning and seasonal timing.');
    await page
      .locator('#execution-plan-editor textarea')
      .nth(3)
      .fill('Prepare content, acquisition, CRM follow-up, and buyer reminders.');
    await page.getByRole('button', { name: 'Create and link execution plan' }).click();
    await expect(
      page.getByText(
        'Execution plan created and linked to its annual plan, month, revenue line, targets, and event.',
      ),
    ).toBeVisible();
    await expect(page.getByText('Leadership Course Execution Plan').first()).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Strategy to results' })).toBeVisible();
    await expect(page.getByText('2027 / 2027 Commercial Growth Portfolio')).toBeVisible();
    await expect(page.getByText('12 leads / 3 purchases')).toBeVisible();
    await page.getByLabel('Use approved learning').selectOption('finding-1');
    await page.getByRole('button', { name: 'Use learning' }).click();
    await expect(page.getByText('Approved learning is now recorded behind this execution plan.')).toBeVisible();
    await expect(page.getByText('Repeat warm-audience launch sequence')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Budget control' })).toBeVisible();
    await page.getByLabel('Choose work to allocate').selectOption({
      label: 'Ramadan Leadership Course - Online Courses',
    });
    await expect(page.getByLabel('Amount (AED)')).toHaveValue('50000');
    await page.getByRole('button', { name: 'Save allocation' }).click();
    await expect(
      page.getByText('Budget allocation saved. It remains planned until an executive approves it.'),
    ).toBeVisible();
    await expect(page.locator(`[data-allocation-id="${allocationId}"]`)).toContainText(
      'Ramadan Leadership Course',
    );

    await page.getByRole('button', { name: /Open execution plan/ }).click();
    await expect(page).toHaveURL(new RegExp(`/commercial-plans\\?.*planId=${detailedPlanId}`));
    await expect(page.getByRole('heading', { name: 'Execution Plans' })).toBeVisible();
    await expect(page.getByLabel('Plan title')).toHaveValue('Leadership Course Execution Plan');

    await page.goBack();
    await expect(page.getByRole('heading', { name: 'Annual Commercial Plan' })).toBeVisible();
    await page.getByRole('button', { name: 'Submit for approval' }).click();
    await expect(page.getByText('Annual plan submitted for approval.')).toBeVisible();
    await page.getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByText('Annual plan approved.')).toBeVisible();
    await expect(page.getByText('Approved', { exact: true }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (process.env.UX_CAPTURE === '1')
      await page.screenshot({ path: 'tmp/codex-annual-planning-desktop.png', fullPage: true });
    monitor.assertClean();
  });

  test('twelve-month portfolio remains usable on mobile and tablet', async ({ page }) => {
    const monitor = await installMocks(page, true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/commercial-planning');

    await expect(page.getByRole('heading', { name: 'Annual Commercial Plan' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile product navigation' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Jan/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^Dec/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    if (process.env.UX_CAPTURE === '1')
      await page.screenshot({ path: 'tmp/codex-annual-planning-mobile.png', fullPage: true });

    await page.setViewportSize({ width: 768, height: 900 });
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Product navigation' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    monitor.assertClean();
  });

  test('specialist can review annual context without manager controls or hidden failures', async ({
    page,
  }) => {
    const monitor = await installMocks(page, true, 'specialist');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/commercial-planning');

    await expect(page.getByRole('heading', { name: 'Annual Commercial Plan' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Add initiative|Add to/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save direction' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Submit for approval' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Plan with Stitchi' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    monitor.assertClean();
  });
});
