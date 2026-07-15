import { expect, test, type Page } from '@playwright/test';

type ProductRole = 'marketing_manager' | 'admin';

const manager = {
  id: 'user-marketing-manager',
  email: 'marketing.manager@tanaghum.com',
  name: 'Marketing Manager',
  role: 'marketing_manager' as const,
  tenantKey: 'default',
};

const admin = {
  id: 'user-admin',
  email: 'admin@tanaghum.com',
  name: 'Workspace Admin',
  role: 'admin' as const,
  tenantKey: 'default',
};

const dashboard = {
  revenueLines: [{
    id: 'line-live-event',
    revenueLineType: 'live_event',
    name: 'Live Events',
    description: 'Operate launches, leads, sales, and learning.',
    status: 'active',
    configured: true,
    planCount: 1,
    openSignalCount: 1,
  }],
  stageSummary: { assess: 2, strategy_planning: 4, implementation_engagement: 3 },
  rollups: { plannedRevenueTarget: 30000, knownRevenue: 18420, knownSpend: 3050, leads: 184, purchases: 18 },
};

const lineDashboard = {
  revenueLine: dashboard.revenueLines[0],
  rollups: {
    plannedRevenueTarget: 30000,
    knownRevenue: 18420,
    knownSpend: 3050,
    leads: 184,
    purchases: 18,
    leadToPurchaseRate: 9.8,
  },
  dataStatus: {
    hasLinkedEvents: true,
    hasKpiRecords: true,
    hasLeadRecords: true,
    missingDataSources: ['Meta Ads performance'],
  },
  plans: [{
    id: 'plan-leadership',
    title: 'Leadership Course Launch',
    status: 'active',
    stage: 'strategy_planning',
    budgetTarget: 5000,
    revenueTarget: 30000,
  }],
  openSignals: [{
    id: 'signal-conversion',
    title: 'Form completion needs attention',
    severity: 'warning',
    recommendedAction: 'Review the Meta campaign before increasing budget.',
  }],
  nextAction: {
    label: 'Review lead conversion',
    description: 'Form completion is below the current plan target.',
    path: '/analytics',
  },
};

const idea = {
  id: 'idea-leadership',
  title: 'Lead With Courage',
  hook: 'Turn leadership pressure into a practical growth decision.',
  platform: 'instagram',
  format: 'carousel',
  hashtags: ['leadership', 'entrepreneurs'],
  estimatedReach: 'high',
  rationale: 'Matches the audience and the requested conversion goal.',
};

const approval = {
  id: 'approval-leadership',
  targetType: 'campaign_content',
  approvalStatus: 'pending',
  riskCategory: 'medium',
  createdAt: '2026-07-10T09:00:00.000Z',
};

function approvalPacket() {
  return {
    campaign: {
      id: 'campaign-leadership',
      topic: 'Leadership Course Launch',
      objective: 'Convert warm followers into course buyers.',
      audience: 'Entrepreneurs and previous buyers.',
      callToAction: 'Reserve your seat.',
    },
    contentItem: {
      id: 'content-leadership',
      platform: 'instagram',
      reachScore: 82,
      riskReason: 'The claim needs one supporting example before scheduling.',
    },
    latestDraftVersion: {
      versionNo: 3,
      text: 'Leadership is not the absence of pressure. It is the decision to move with clarity when pressure arrives.',
    },
    publishingPackages: [{ id: 'package-leadership', status: 'draft' }],
  };
}

async function installMocks(page: Page, role: ProductRole) {
  let directionSelected = false;
  let campaignCreated = false;
  let approvalStatus = 'pending';
  const unexpected: string[] = [];
  const browserErrors: string[] = [];
  const failedResponses: string[] = [];

  await page.addInitScript(() => window.localStorage.setItem('token', 'ux-r1b-token'));
  page.on('console', message => {
    if (message.type() === 'error') browserErrors.push(message.text());
  });
  page.on('pageerror', error => browserErrors.push(`pageerror: ${error.message}`));
  page.on('response', response => {
    if (response.url().includes(':4000') && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    if (request.resourceType() === 'document') {
      await route.continue();
      return;
    }
    const apiPrefixes = [
      '/auth/',
      '/commercial-command-center/',
      '/ai-provider/',
      '/campaigns',
      '/ideas/',
      '/ai-generation/',
      '/approvals',
      '/publishing-package/',
    ];
    if (!apiPrefixes.some(prefix => path === prefix || path.startsWith(prefix))) {
      await route.continue();
      return;
    }
    const user = role === 'admin' ? admin : manager;
    const json = (body: unknown, status = 200) => route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    if (path === '/auth/session') return json({ user, agentRep: { id: `agent-${role}`, name: `${user.name} Profile`, status: 'active' } });
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/commercial-command-center/dashboard') return json(dashboard);
    if (path === '/commercial-command-center/revenue-lines/live_event/dashboard') return json(lineDashboard);
    if (path === '/ai-provider/active') return json({ provider: 'gemma', model: 'gemma4-26b-a4b-canary', apiKeyStatus: 'configured' });
    if (path === '/campaigns' && method === 'GET') return json(campaignCreated ? [{
      id: 'campaign-leadership',
      topic: 'Leadership Course Launch',
      status: 'idea',
      targetPlatforms: ['instagram'],
      objective: idea.hook,
      riskCategory: idea.estimatedReach,
    }] : []);
    if (path === '/ideas/generate' && method === 'POST') return json({
      workflow: { threadId: 'workflow-leadership', status: 'awaiting_selection' },
      ideas: [idea],
      provider: 'gemma',
      model: 'gemma4-26b-a4b-canary',
      apiKeyStatus: 'configured',
      generationMode: 'live_provider',
    });
    if (path === '/ideas/workflows/workflow-leadership/resume' && method === 'POST') {
      directionSelected = true;
      return json({ threadId: 'workflow-leadership', status: 'selected', selectedIdeaId: idea.id });
    }
    if (path === '/ideas/convert-to-campaign' && method === 'POST') {
      if (!directionSelected) return json({ error: 'Direction must be selected first.' }, 409);
      campaignCreated = true;
      return json({ campaignId: 'campaign-leadership', title: 'Leadership Course Launch', status: 'idea' }, 201);
    }
    if (path === '/ai-generation/generate' && method === 'POST') return json([{
      contentItemId: 'content-leadership',
      campaignRequestId: 'campaign-leadership',
      platform: 'instagram',
      contentType: 'carousel',
      draftText: 'Leadership begins before confidence arrives. Choose the next right action.',
      versionNo: 1,
      status: 'drafting',
      riskNotes: 'No unsupported outcome promise detected.',
    }], 201);
    if (path === '/approvals' && method === 'GET') return json([{ ...approval, approvalStatus }]);
    if (path === '/approvals/approval-leadership/decision-packet' && method === 'GET') return json(approvalPacket());
    if (path === '/publishing-package/list' && method === 'GET') return json([{ id: 'package-leadership', status: 'draft' }]);
    if (path === '/approvals/approval-leadership/approve' && method === 'POST') {
      approvalStatus = 'approved';
      return json({ ...approval, approvalStatus });
    }

    unexpected.push(`${method} ${path}`);
    return json({ error: `Unexpected UX-R1B request: ${method} ${path}` }, 500);
  });

  return {
    assertClean() {
      expect(unexpected, 'The tested customer path must not call unrelated APIs').toEqual([]);
      expect(failedResponses, 'The tested customer path must not receive failed API responses').toEqual([]);
      expect(browserErrors, 'The tested customer path must not log browser errors').toEqual([]);
    },
  };
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

test.describe('UX-R1B Hybrid customer shell', () => {
  test('marketing manager can move from Today to AI content creation without admin noise', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/command-center');

    await expect(page).toHaveTitle('Today | Tanaghum');
    await expect(page.getByRole('heading', { name: "Today's Commercial Priorities" })).toBeVisible();
    await expect(page.getByLabel('Commercial performance summary').getByText(/AED\s*18,420/)).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Product navigation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users & Roles' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Workspace Admin' })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.getByRole('link', { name: 'Content', exact: true }).click();
    await expect(page).toHaveURL(/\/ideas$/);
    await expect(page).toHaveTitle('Content | Tanaghum');
    await expect(page.getByRole('heading', { name: 'Create Campaign Content' })).toBeVisible();

    await page.getByLabel('Campaign Name').fill('Leadership Course Launch');
    await page.getByLabel('Objective').fill('Sell a leadership course to entrepreneurs.');
    await page.getByLabel('Audience').fill('Warm followers and previous buyers.');
    await page.getByRole('button', { name: 'Generate Directions' }).click();
    await expect(page.getByRole('heading', { name: 'Choose A Direction' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lead With Courage', level: 3 })).toBeVisible();
    await page.getByRole('button', { name: /Lead With Courage/i }).click();
    await page.getByRole('button', { name: 'Select Direction' }).click();
    await expect(page.getByText('Direction selected. Create the campaign when you are ready.')).toBeVisible();
    await page.getByRole('button', { name: 'Create Draft' }).click();
    await expect(page.locator('.content-draft-section').getByRole('heading', { name: 'Leadership Course Launch' })).toBeVisible();
    await expect(page.getByLabel('Content Draft')).toHaveValue(/Leadership begins before confidence arrives/);
    await expectNoHorizontalOverflow(page);
    monitor.assertClean();
  });

  test('mobile shell keeps core navigation reachable without covering the page', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ideas');

    await expect(page.getByRole('navigation', { name: 'Mobile product navigation' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Campaign Content' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open workspace menu' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.getByRole('button', { name: 'Open workspace menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Workspace menu' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'AI Model' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Users & Roles' })).toHaveCount(0);
    await page.getByRole('dialog', { name: 'Workspace menu' }).getByRole('button', { name: 'Close workspace menu' }).click();
    await expect(page.getByRole('dialog', { name: 'Workspace menu' })).toHaveCount(0);
    await page.setViewportSize({ width: 768, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Mobile product navigation' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Product navigation' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile product navigation' })).toBeHidden();
    await expectNoHorizontalOverflow(page);
    monitor.assertClean();
  });

  test('admin reviewer sees one complete decision context and can approve it', async ({ page }) => {
    const monitor = await installMocks(page, 'admin');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/command-center');
    await page.getByRole('button', { name: 'Setup & More' }).click();
    await page.getByRole('link', { name: 'Review Queue' }).click();

    await expect(page).toHaveTitle('Review | Tanaghum');
    await expect(page.getByRole('heading', { name: 'Review Content' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Leadership Course Launch' })).toBeVisible();
    await expect(page.getByText(/Leadership is not the absence of pressure/)).toBeVisible();
    await expect(page.getByText('82/100')).toBeVisible();
    await expect(page.getByText('1 prepared')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Content' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: /Leadership Course Launch/i }).click();
    await expect(page.getByRole('button', { name: 'Back to Queue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Content' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
    await page.getByRole('button', { name: 'Approve Content' }).click();
    await expect(page.getByText('Content approved and prepared for scheduling.')).toBeVisible();
    monitor.assertClean();
  });
});
