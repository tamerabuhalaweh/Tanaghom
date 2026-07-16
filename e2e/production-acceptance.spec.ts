import { expect, test, type APIRequestContext, type Page, type TestInfo } from '@playwright/test';

const acceptanceEnabled = process.env.E2E_PRODUCTION_ACCEPTANCE === 'true';
const apiBase = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000';
const password = process.env.E2E_ACCEPTANCE_PASSWORD || '';

const fixtures = {
  primaryTenantKey: 'acceptance-primary',
  isolationTenantKey: 'acceptance-isolation',
  campaignId: '91000000-0000-4000-8000-000000000001',
  historicalEventId: '91000000-0000-4000-8000-000000000004',
  futureEventId: '91000000-0000-4000-8000-000000000005',
  revenueLineId: '91000000-0000-4000-8000-000000000007',
  usdPlanId: '91000000-0000-4000-8000-000000000008',
  assessmentRunId: '91000000-0000-4000-8000-000000000009',
  approvedFindingId: '91000000-0000-4000-8000-000000000011',
  rejectedFindingId: '91000000-0000-4000-8000-000000000012',
  accounts: {
    manager: 'acceptance.manager@tanaghum.test',
    cco: 'acceptance.cco@tanaghum.test',
    specialist: 'acceptance.specialist@tanaghum.test',
    reviewer: 'acceptance.reviewer@tanaghum.test',
    viewer: 'acceptance.viewer@tanaghum.test',
    admin: 'acceptance.admin@tanaghum.test',
    other: 'acceptance.other@tanaghum.test',
  },
} as const;

type LoginSession = {
  token: string;
  user: { id: string; role: string; agentRepId: string | null; tenantKey: string };
};

type AnnualPlan = {
  id: string;
  revision: number;
  status: string;
  currency: string;
  items: Array<{ id: string; title: string; month: number }>;
  learningSets: Array<{ id: string }>;
};

const workflow: {
  annualPlanId?: string;
  monthlyItemId?: string;
  executionPlanId?: string;
  learningSetId?: string;
  conversationId?: string;
  completedActionId?: string;
} = {};

async function login(request: APIRequestContext, email: string): Promise<LoginSession> {
  const response = await request.post(`${apiBase}/auth/login`, { data: { email, password } });
  expect(response.ok(), `${email}: ${await response.text()}`).toBeTruthy();
  return response.json() as Promise<LoginSession>;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function expectOk<T = unknown>(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<T>;
}

async function expectStatus(
  response: Awaited<ReturnType<APIRequestContext['get']>>,
  status: number,
) {
  expect(response.status(), await response.text()).toBe(status);
}

async function loginInBrowser(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Open Command Center' }).click();
  await expect(page).toHaveURL(/\/command-center(?:$|[?#])/);
}

function monitorBrowser(page: Page) {
  const consoleProblems: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', error => consoleProblems.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.status() >= 400 && !response.url().includes('/favicon')) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });
  return {
    reset() {
      consoleProblems.length = 0;
      failedResponses.length = 0;
    },
    assertClean(label: string) {
      expect(consoleProblems, `${label}: browser console`).toEqual([]);
      expect(failedResponses, `${label}: unexpected network responses`).toEqual([]);
    },
  };
}

async function assertCustomerSurface(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  const main = page.locator('main');
  if ((await main.count()) === 0) {
    throw new Error(
      `${path} did not render the product shell; current URL is ${page.url()} and title is ${await page.title()}`,
    );
  }
  await expect(main, `${path} should render the authenticated product shell`).toBeVisible({
    timeout: 10000,
  });
  const text = await main.innerText();
  expect(text).not.toMatch(/\b(?:Sprint\s*\d+|acceptance fixture|test tenant|Mock LLM|MCP|M5)\b/i);
  expect(text).not.toMatch(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, `${path}: horizontal overflow`).toBeLessThanOrEqual(2);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage: true }),
    contentType: 'image/png',
  });
}

test.describe('Hybrid production acceptance harness', () => {
  test.setTimeout(180_000);
  test.skip(
    !acceptanceEnabled || password.length < 16,
    'Set E2E_PRODUCTION_ACCEPTANCE=true and a 16+ character E2E_ACCEPTANCE_PASSWORD.',
  );
  test.describe.configure({ mode: 'serial' });

  test('proves the complete governed commercial journey and negative boundaries', async ({
    request,
  }) => {
    const sessions = {
      manager: await login(request, fixtures.accounts.manager),
      cco: await login(request, fixtures.accounts.cco),
      specialist: await login(request, fixtures.accounts.specialist),
      reviewer: await login(request, fixtures.accounts.reviewer),
      viewer: await login(request, fixtures.accounts.viewer),
      admin: await login(request, fixtures.accounts.admin),
      other: await login(request, fixtures.accounts.other),
    };
    expect(sessions.manager.user).toMatchObject({
      role: 'department_head',
      tenantKey: fixtures.primaryTenantKey,
    });
    expect(sessions.cco.user.role).toBe('cco');
    expect(sessions.specialist.user.role).toBe('specialist');
    expect(sessions.reviewer.user.role).toBe('reviewer');
    expect(sessions.viewer.user.role).toBe('viewer');
    expect(sessions.admin.user.role).toBe('admin');
    expect(sessions.other.user.tenantKey).toBe(fixtures.isolationTenantKey);

    const usdBefore = await expectOk<Array<{ id: string; currency: string; budgetTarget: number }>>(
      await request.get(`${apiBase}/commercial-command-center/plans`, {
        headers: auth(sessions.manager.token),
      }),
    );
    expect(usdBefore).toContainEqual(
      expect.objectContaining({ id: fixtures.usdPlanId, currency: 'USD', budgetTarget: 1000 }),
    );

    const preview = await expectOk<{ evidence: unknown[]; missingData: string[] }>(
      await request.post(`${apiBase}/commercial-assessments/preview`, {
        headers: auth(sessions.manager.token),
        data: {
          revenueLineId: fixtures.revenueLineId,
          eventIds: [fixtures.historicalEventId],
          campaignIds: [],
          channels: ['instagram'],
          dateFrom: '2025-01-01T00:00:00.000Z',
          dateTo: '2025-12-31T23:59:59.000Z',
        },
      }),
    );
    expect(preview.evidence.length).toBeGreaterThan(0);

    await expectStatus(
      await request.post(
        `${apiBase}/commercial-assessments/findings/${fixtures.approvedFindingId}/decision`,
        {
          headers: auth(sessions.specialist.token),
          data: { decision: 'approved', reason: 'Specialists must not approve learning.' },
        },
      ),
      403,
    );
    const approvedAssessment = await expectOk<{ findings: Array<{ decision: string }> }>(
      await request.post(
        `${apiBase}/commercial-assessments/findings/${fixtures.approvedFindingId}/decision`,
        {
          headers: auth(sessions.cco.token),
          data: {
            decision: 'approved',
            reason: 'The verified 2025 KPI evidence supports reuse in annual planning.',
          },
        },
      ),
    );
    expect(approvedAssessment.findings).toContainEqual(
      expect.objectContaining({ decision: 'approved' }),
    );
    await expectOk(
      await request.post(
        `${apiBase}/commercial-assessments/findings/${fixtures.rejectedFindingId}/decision`,
        {
          headers: auth(sessions.cco.token),
          data: {
            decision: 'rejected',
            reason: 'This hypothesis requires another controlled campaign before reuse.',
          },
        },
      ),
    );
    const learningSets = await expectOk<Array<{ id: string; findings: Array<{ id: string }> }>>(
      await request.get(`${apiBase}/commercial-assessments/learning-sets`, {
        headers: auth(sessions.manager.token),
      }),
    );
    const learningSet = learningSets.find(set =>
      set.findings.some(finding => finding.id === fixtures.approvedFindingId),
    );
    expect(learningSet).toBeTruthy();
    workflow.learningSetId = learningSet!.id;

    const providerStatus = await expectOk<{
      activeProvider: string;
      providers: Array<{ type: string; configured: boolean }>;
    }>(
      await request.get(`${apiBase}/ai-provider/status`, {
        headers: auth(sessions.manager.token),
      }),
    );
    const activeProvider = providerStatus.providers.find(
      provider => provider.type === providerStatus.activeProvider,
    );
    const providerReady = Boolean(
      activeProvider?.configured && activeProvider.type !== 'mock',
    );

    const providerAssessment = await expectOk<{ id: string; status: string }>(
      await request.post(`${apiBase}/commercial-assessments`, {
        headers: auth(sessions.manager.token),
        data: {
          title: `Provider boundary ${Date.now()}`,
          revenueLineId: fixtures.revenueLineId,
          eventIds: [fixtures.historicalEventId],
          campaignIds: [],
          channels: ['instagram'],
          dateFrom: '2025-01-01T00:00:00.000Z',
          dateTo: '2025-12-31T23:59:59.000Z',
        },
      }),
    );
    const providerGeneration = await request.post(
      `${apiBase}/commercial-assessments/${providerAssessment.id}/generate`,
      { headers: auth(sessions.manager.token) },
    );
    expect(providerGeneration.status(), await providerGeneration.text()).toBe(
      providerReady ? 200 : 424,
    );
    const providerRun = await expectOk<{ status: string; findings: unknown[] }>(
      await request.get(`${apiBase}/commercial-assessments/${providerAssessment.id}`, {
        headers: auth(sessions.manager.token),
      }),
    );
    if (providerReady) {
      expect(providerRun.status).toBe('generated');
      expect(providerRun.findings.length).toBeGreaterThan(0);
    } else {
      expect(providerRun.status).toBe('failed');
      expect(providerRun.findings).toHaveLength(0);
    }

    await expectStatus(
      await request.post(`${apiBase}/annual-commercial-plans`, {
        headers: auth(sessions.specialist.token),
        data: { year: 2027, title: 'Unauthorized specialist plan', budgetTarget: 1 },
      }),
      403,
    );
    await expectStatus(
      await request.post(`${apiBase}/commercial-command-center/plans`, {
        headers: auth(sessions.viewer.token),
        data: {
          revenueLineId: fixtures.revenueLineId,
          horizon: 'product_or_event',
          title: 'Unauthorized viewer plan',
          standaloneReason: 'Unauthorized viewer attempt outside the approved annual calendar.',
        },
      }),
      403,
    );

    const suffix = Date.now().toString();
    let annualPlan = await expectOk<AnnualPlan>(
      await request.post(`${apiBase}/annual-commercial-plans`, {
        headers: auth(sessions.manager.token),
        data: {
          year: 2027,
          title: `2027 Leadership Growth Plan ${suffix}`,
          strategy: 'Use approved historical learning to scale trusted course launches.',
          currency: 'AED',
          budgetTarget: 50000,
          revenueTarget: 300000,
          ownerUserId: sessions.manager.user.id,
          learningSetIds: [workflow.learningSetId],
        },
      }),
    );
    workflow.annualPlanId = annualPlan.id;
    expect(annualPlan).toMatchObject({ status: 'draft', currency: 'AED' });
    expect(annualPlan.learningSets).toContainEqual(
      expect.objectContaining({ id: workflow.learningSetId }),
    );

    annualPlan = await expectOk<AnnualPlan>(
      await request.post(`${apiBase}/annual-commercial-plans/${annualPlan.id}/items`, {
        headers: auth(sessions.manager.token),
        data: {
          expectedRevision: annualPlan.revision,
          month: 3,
          revenueLineId: fixtures.revenueLineId,
          eventId: fixtures.futureEventId,
          title: 'Leadership Course Launch',
          plannedStartDate: '2027-03-01T09:00:00.000Z',
          plannedEndDate: '2027-03-20T09:00:00.000Z',
          currency: 'AED',
          budgetAllocation: 40000,
          revenueTarget: 250000,
          priority: 'high',
          readiness: 'ready',
          ownerUserId: sessions.manager.user.id,
        },
      }),
    );
    workflow.monthlyItemId = annualPlan.items.find(item => item.title === 'Leadership Course Launch')!.id;

    const budget = await expectOk<{ allocations: Array<{ id: string; revision: number }> }>(
      await request.post(
        `${apiBase}/commercial-budget-reconciliation/annual-plans/${annualPlan.id}/allocations`,
        {
          headers: auth(sessions.manager.token),
          data: {
            level: 'monthly_item',
            monthlyPortfolioItemId: workflow.monthlyItemId,
            currency: 'AED',
            amount: 40000,
            reason: 'Fund the March leadership course launch.',
            allowOverAllocation: false,
          },
        },
      ),
    );
    const rootAllocation = budget.allocations[0];
    expect(rootAllocation).toBeTruthy();
    await expectStatus(
      await request.put(
        `${apiBase}/commercial-budget-reconciliation/annual-plans/${annualPlan.id}/allocations/${rootAllocation.id}`,
        {
          headers: auth(sessions.manager.token),
          data: {
            expectedRevision: rootAllocation.revision,
            amount: 60000,
            reason: 'This exceeds the approved annual envelope.',
            allowOverAllocation: false,
          },
        },
      ),
      400,
    );

    annualPlan = await expectOk<AnnualPlan>(
      await request.post(`${apiBase}/annual-commercial-plans/${annualPlan.id}/submit`, {
        headers: auth(sessions.manager.token),
        data: { expectedRevision: annualPlan.revision, reason: 'Ready for executive review.' },
      }),
    );
    await expectStatus(
      await request.post(`${apiBase}/annual-commercial-plans/${annualPlan.id}/approve`, {
        headers: auth(sessions.manager.token),
        data: { expectedRevision: annualPlan.revision, reason: 'Self-approval must be denied.' },
      }),
      403,
    );
    annualPlan = await expectOk<AnnualPlan>(
      await request.post(`${apiBase}/annual-commercial-plans/${annualPlan.id}/approve`, {
        headers: auth(sessions.cco.token),
        data: { expectedRevision: annualPlan.revision, reason: 'Approved against verified AED targets.' },
      }),
    );
    expect(annualPlan.status).toBe('approved');
    const approvedBudget = await expectOk<{ allocations: Array<{ id: string; status: string }> }>(
      await request.post(
        `${apiBase}/commercial-budget-reconciliation/annual-plans/${annualPlan.id}/allocations/${rootAllocation.id}/approve`,
        {
          headers: auth(sessions.cco.token),
          data: { expectedRevision: 1, reason: 'Approved inside the annual AED envelope.' },
        },
      ),
    );
    expect(approvedBudget.allocations).toContainEqual(
      expect.objectContaining({ id: rootAllocation.id, status: 'approved' }),
    );

    const executionPlan = await expectOk<{ id: string; title: string; currency: string }>(
      await request.post(`${apiBase}/commercial-command-center/plans`, {
        headers: auth(sessions.manager.token),
        data: {
          revenueLineId: fixtures.revenueLineId,
          linkedEventId: fixtures.futureEventId,
          horizon: 'product_or_event',
          stage: 'implementation_engagement',
          title: `March Leadership Course Execution ${suffix}`,
          objective: 'Convert warm audiences into paid leadership course buyers.',
          audience: 'Warm followers and previous buyers in the UAE.',
          currency: 'AED',
          budgetTarget: 40000,
          revenueTarget: 250000,
          strategySummary: 'Apply approved learning before paid amplification.',
          actionPlan: 'Content, retargeting, CRM follow-up, and WhatsApp reminders.',
          status: 'active',
          ownerUserId: sessions.manager.user.id,
        },
      }),
    );
    workflow.executionPlanId = executionPlan.id;
    expect(executionPlan.currency).toBe('AED');

    await expectOk(
      await request.put(`${apiBase}/commercial-hierarchy/plans/${executionPlan.id}/parent`, {
        headers: auth(sessions.manager.token),
        data: { annualPlanId: annualPlan.id, monthlyPortfolioItemId: workflow.monthlyItemId },
      }),
    );
    await expectOk(
      await request.post(`${apiBase}/commercial-hierarchy/plans/${executionPlan.id}/events`, {
        headers: auth(sessions.manager.token),
        data: { eventId: fixtures.futureEventId, primary: true },
      }),
    );
    await expectOk(
      await request.post(`${apiBase}/commercial-hierarchy/plans/${executionPlan.id}/campaigns`, {
        headers: auth(sessions.manager.token),
        data: { campaignId: fixtures.campaignId },
      }),
    );
    await expectOk(
      await request.post(`${apiBase}/commercial-hierarchy/plans/${executionPlan.id}/learning`, {
        headers: auth(sessions.manager.token),
        data: {
          learningSetId: workflow.learningSetId,
          findingIds: [fixtures.approvedFindingId],
          rationale: 'The annual and execution plan reuse the approved warm-audience learning.',
        },
      }),
    );
    const hierarchy = await expectOk<{
      commercial_plan: { id: string };
      activeEventLinks: Array<{ event_id: string }>;
      activeCampaignLinks: Array<{ campaign_id: string }>;
      activeLearningInfluences: Array<{ finding_id: string }>;
    }>(
      await request.get(`${apiBase}/commercial-hierarchy/plans/${executionPlan.id}`, {
        headers: auth(sessions.manager.token),
      }),
    );
    expect(hierarchy.activeEventLinks).toContainEqual(
      expect.objectContaining({ event_id: fixtures.futureEventId }),
    );
    expect(hierarchy.activeCampaignLinks).toContainEqual(
      expect.objectContaining({ campaign_id: fixtures.campaignId }),
    );
    expect(hierarchy.activeLearningInfluences).toContainEqual(
      expect.objectContaining({ finding_id: fixtures.approvedFindingId }),
    );

    const conversation = await expectOk<{ id: string }>(
      await request.post(`${apiBase}/stitchi/conversations`, {
        headers: auth(sessions.manager.token),
        data: { title: 'Review the March execution plan', eventId: fixtures.futureEventId },
      }),
    );
    workflow.conversationId = conversation.id;
    const actionPayload = {
      actionType: 'create_commercial_assessment_signal',
      inputPayload: {
        revenueLineId: fixtures.revenueLineId,
        commercialPlanId: executionPlan.id,
        sourceType: 'stitchi',
        title: 'Monitor warm-audience conversion',
        severity: 'watch',
        finding: 'Track conversion after the first retargeting week.',
        recommendedAction: 'Review qualified leads before increasing spend.',
      },
      previewPayload: { title: 'Monitor warm-audience conversion', externalExecution: 'blocked' },
      requiresApproval: true,
      riskLevel: 'medium',
    };
    const cancelledAction = await expectOk<{ id: string }>(
      await request.post(`${apiBase}/stitchi/conversations/${conversation.id}/actions`, {
        headers: auth(sessions.manager.token),
        data: actionPayload,
      }),
    );
    const cancelled = await expectOk<{ status: string }>(
      await request.post(`${apiBase}/stitchi/actions/${cancelledAction.id}/cancel`, {
        headers: auth(sessions.manager.token),
        data: { notes: 'Cancel the first proposal without changing commercial records.' },
      }),
    );
    expect(cancelled.status).toBe('cancelled');

    const approvedAction = await expectOk<{ id: string }>(
      await request.post(`${apiBase}/stitchi/conversations/${conversation.id}/actions`, {
        headers: auth(sessions.manager.token),
        data: actionPayload,
      }),
    );
    workflow.completedActionId = approvedAction.id;
    await expectStatus(
      await request.post(`${apiBase}/stitchi/actions/${approvedAction.id}/approve-and-execute`, {
        headers: auth(sessions.manager.token),
        data: { notes: 'A department head cannot self-approve.' },
      }),
      403,
    );
    const execution = await expectOk<{
      actionRun: { status: string };
      executed: { objectType: string; objectId: string };
      idempotent: boolean;
    }>(
      await request.post(`${apiBase}/stitchi/actions/${approvedAction.id}/approve-and-execute`, {
        headers: auth(sessions.cco.token),
        data: { notes: 'Approved as an internal planning record only.' },
      }),
    );
    expect(execution).toMatchObject({
      actionRun: { status: 'completed' },
      executed: { objectType: 'commercial_assessment_signal' },
      idempotent: false,
    });
    const duplicate = await expectOk<{ idempotent: boolean; executed: { objectId: string } }>(
      await request.post(`${apiBase}/stitchi/actions/${approvedAction.id}/approve-and-execute`, {
        headers: auth(sessions.cco.token),
        data: { notes: 'Duplicate client retry must not execute twice.' },
      }),
    );
    expect(duplicate).toEqual(
      expect.objectContaining({
        idempotent: true,
        executed: expect.objectContaining({ objectId: execution.executed.objectId }),
      }),
    );

    const audit = await expectOk<Array<{ action: string }>>(
      await request.get(`${apiBase}/observability/audit?objectId=${approvedAction.id}`, {
        headers: auth(sessions.admin.token),
      }),
    );
    expect(audit.map(record => record.action)).toEqual(
      expect.arrayContaining([
        'stitchi_action_run_created',
        'stitchi_action_approved',
        'stitchi_action_completed',
      ]),
    );

    const futureEvidence = await expectOk<{ evidence: Array<{ sourceObjectId: string }> }>(
      await request.post(`${apiBase}/commercial-assessments/preview`, {
        headers: auth(sessions.manager.token),
        data: {
          revenueLineId: fixtures.revenueLineId,
          eventIds: [],
          campaignIds: [fixtures.campaignId],
          channels: ['instagram'],
          dateFrom: '2026-01-01T00:00:00.000Z',
          dateTo: '2028-12-31T23:59:59.000Z',
        },
      }),
    );
    expect(futureEvidence.evidence.map(row => row.sourceObjectId)).toEqual(
      expect.arrayContaining([executionPlan.id, fixtures.campaignId]),
    );

    const usdAfter = await expectOk<Array<{ id: string; currency: string; budgetTarget: number }>>(
      await request.get(`${apiBase}/commercial-command-center/plans`, {
        headers: auth(sessions.manager.token),
      }),
    );
    expect(usdAfter).toContainEqual(
      expect.objectContaining({ id: fixtures.usdPlanId, currency: 'USD', budgetTarget: 1000 }),
    );
    expect(usdAfter).toContainEqual(
      expect.objectContaining({ id: executionPlan.id, currency: 'AED', budgetTarget: 40000 }),
    );

    for (const path of [
      `/commercial-assessments/${fixtures.assessmentRunId}`,
      `/annual-commercial-plans/${annualPlan.id}`,
      `/commercial-hierarchy/plans/${executionPlan.id}`,
      `/stitchi/conversations/${conversation.id}`,
    ]) {
      await expectStatus(
        await request.get(`${apiBase}${path}`, { headers: auth(sessions.other.token) }),
        404,
      );
    }
  });

  test('proves role-based customer pages without hidden authorization or browser failures', async ({
    page,
  }, testInfo) => {
    const monitor = monitorBrowser(page);
    const personas = [
      { key: 'manager', email: fixtures.accounts.manager, mutatesAnnual: true, approves: false },
      { key: 'cco', email: fixtures.accounts.cco, mutatesAnnual: true, approves: true },
      { key: 'specialist', email: fixtures.accounts.specialist, mutatesAnnual: false, approves: false },
      { key: 'reviewer', email: fixtures.accounts.reviewer, mutatesAnnual: false, approves: false },
      { key: 'viewer', email: fixtures.accounts.viewer, mutatesAnnual: false, approves: false },
      { key: 'admin', email: fixtures.accounts.admin, mutatesAnnual: true, approves: true },
    ] as const;
    const routes = [
      '/command-center',
      '/commercial-assessment',
      '/commercial-planning',
      '/commercial-plans',
      '/events',
      '/ideas',
      '/analytics',
      '/stitchi',
    ];

    await page.setViewportSize({ width: 1440, height: 900 });
    for (const persona of personas) {
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear()).catch(() => undefined);
      await loginInBrowser(page, persona.email);
      monitor.reset();
      for (const route of routes) {
        await test.step(`${persona.key} opens ${route}`, async () => {
          await assertCustomerSurface(page, route);
        });
      }

      await page.goto('/commercial-planning');
      await page.getByLabel('Planning year').selectOption('2028');
      await expect(page.getByRole('heading', { name: 'Create the 2028 annual plan' })).toBeVisible();
      if (persona.mutatesAnnual) {
        await expect(page.getByRole('button', { name: 'Create annual plan' })).toBeVisible();
      } else {
        await expect(page.getByRole('button', { name: 'Create annual plan' })).toHaveCount(0);
      }
      await page.goto('/commercial-assessment');
      if (!persona.approves) {
        await expect(page.getByRole('button', { name: 'Approve', exact: true })).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Reject', exact: true })).toHaveCount(0);
      }
      monitor.assertClean(`${persona.key} role matrix`);
      await attachScreenshot(page, testInfo, `role-${persona.key}`);
    }
  });

  test('proves responsive, keyboard, and reduced-motion acceptance', async ({ page }, testInfo) => {
    const monitor = monitorBrowser(page);
    await loginInBrowser(page, fixtures.accounts.manager);
    const viewports = [
      { name: 'desktop-1440', width: 1440, height: 900 },
      { name: 'desktop-1920', width: 1920, height: 1080 },
      { name: 'tablet', width: 768, height: 1024 },
      { name: 'mobile', width: 390, height: 844 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      monitor.reset();
      for (const route of ['/commercial-assessment', '/commercial-planning', '/commercial-plans']) {
        await assertCustomerSurface(page, route);
      }
      monitor.assertClean(viewport.name);
      await attachScreenshot(page, testInfo, viewport.name);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await assertCustomerSurface(page, '/commercial-planning');
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to Main Content' });
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    monitor.reset();
    await assertCustomerSurface(page, '/commercial-planning');
    monitor.assertClean('reduced motion');
  });
});
