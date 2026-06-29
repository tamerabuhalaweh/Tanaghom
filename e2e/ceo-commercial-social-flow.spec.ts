import { expect, test, type Page } from '@playwright/test';

const adminUser = {
  id: 'user-1',
  email: 'admin@tanaghum.com',
  name: 'Admin User',
  role: 'admin',
};

const agentRep = {
  id: 'agent-rep-1',
  role: 'admin',
  department: 'Commercial',
};

const campaign = {
  id: 'campaign-1',
  title: 'Premium social intelligence launch',
  objective: 'Generate qualified leads for a premium social media intelligence service.',
  rawMessage: 'Campaign: Premium social intelligence launch\nObjective: Generate qualified leads.',
  audience: 'Marketing directors and CEOs in Jordan and GCC',
  platforms: ['linkedin', 'instagram', 'x'],
  cta: 'Book a strategy call',
  riskCategory: 'low',
  requesterId: 'user-1',
  requesterName: 'Admin User',
  status: 'active',
};

async function installApiMocks(page: Page) {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):4000\/.*/, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    const json = async (body: unknown, status = 200) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    };

    if (pathname === '/auth/login' && method === 'POST') {
      await json({ token: 'e2e-token', user: adminUser, agentRep });
      return;
    }
    if (pathname === '/auth/session') {
      await json({ user: adminUser, agentRep });
      return;
    }
    if (pathname === '/campaigns') {
      await json([campaign]);
      return;
    }
    if (pathname === '/ai-provider/status') {
      await json({
        activeProvider: 'openai',
        providers: [
          { type: 'mock', name: 'Mock Provider', model: 'mock', apiKeyStatus: 'missing' },
          { type: 'openai', name: 'OpenAI', model: 'gpt-5.5', apiKeyStatus: 'configured' },
        ],
        credentialStorage: { rawKeysReturned: false },
      });
      return;
    }
    if (pathname === '/ai-provider/active') {
      await json({
        provider: 'openai',
        name: 'OpenAI',
        model: 'gpt-5.5',
        apiKeyStatus: 'configured',
        generationMode: 'live_provider_active',
        rawKeyReturned: false,
      });
      return;
    }
    if (pathname === '/postiz/status') {
      await json({
        status: 'sandbox_ready',
        serverReachable: true,
        health: {
          credentialStatus: 'configured',
          integrationIdStatus: 'missing',
          url: 'https://postiz.example.test',
        },
      });
      return;
    }
    if (pathname === '/postiz/channels') {
      await json({
        count: 0,
        channels: [],
        rawTokensReturned: false,
        guidance: { title: 'No scheduling channels connected yet' },
      });
      return;
    }
    if (pathname === '/commercial-workflow/state') {
      await json({
        counts: {
          activeCampaigns: 1,
          pendingApprovals: 1,
          approvedApprovals: 0,
          publishingPackages: 0,
          capturedLeads: 2,
          qualifiedLeads: 1,
        },
        readiness: { score: 62 },
        stages: [],
        nextAction: { stage: 'draft' },
        workflowRun: { id: 'workflow-run-1', status: 'active', activeStage: 'draft' },
        safety: { externalWritesEnabled: false, m5WriteExecutionEnabled: false },
        postiz: {
          serverReachable: true,
          connectedChannelCount: 0,
          credentialStatus: 'configured',
          integrationIdStatus: 'missing',
        },
      });
      return;
    }
    if (pathname === '/integration-status') {
      await json({ connectors: [] });
      return;
    }
    if (pathname === '/leads/stats') {
      await json({ total: 2, qualified: 1 });
      return;
    }
    if (pathname === '/leads') {
      await json([
        { id: 'lead-1', name: 'Interested CEO', status: 'qualified', score: 82 },
        { id: 'lead-2', name: 'Marketing Director', status: 'captured', score: 60 },
      ]);
      return;
    }
    if (pathname === '/analytics/sources' || pathname === '/analytics/snapshots' || pathname === '/analytics/reports') {
      await json([]);
      return;
    }
    if (pathname === '/publishing-package/list' || pathname === '/approvals' || pathname === '/publishing-prep/packages') {
      await json([]);
      return;
    }
    if (pathname === '/admin/tenant') {
      await json({
        tenant: { tenantKey: 'default', name: 'Tanaghum', status: 'active' },
        users: { total: 2, active: 2 },
        memberships: { total: 2, active: 2 },
        credentials: { total: 1, active: 1 },
        subscription: { status: 'active' },
      });
      return;
    }
    if (pathname === '/admin/tenant/isolation-report') {
      await json({
        status: 'passed',
        counts: { findings: 0 },
        checks: {
          usersHaveMemberships: true,
          activeUsersHaveActiveMemberships: true,
          membershipRolesMatchUserRoles: true,
        },
        findings: [],
      });
      return;
    }
    if (pathname === '/admin/tenant/lifecycle') {
      await json({ lifecyclePolicy: { status: 'active', supportedActions: ['suspend', 'archive'] } });
      return;
    }
    if (pathname === '/admin/tenant/plans') {
      await json({
        plans: [
          {
            planKey: 'commercial_social_production',
            name: 'Commercial/Social Production',
            status: 'active',
          },
        ],
      });
      return;
    }
    if (pathname === '/admin/tenant/subscription') {
      await json({
        subscription: {
          planKey: 'commercial_social_production',
          planName: 'Commercial/Social Production',
          status: 'active',
          source: 'manual',
        },
        health: {
          serviceAccess: true,
          entitlements: { maxUsers: 25, postizSandboxScheduling: true },
          blockers: [],
          warnings: [],
        },
        paymentProvider: { status: 'not configured' },
      });
      return;
    }
    if (pathname === '/admin/tenant/deletion-readiness') {
      await json({
        deletionReady: false,
        blockers: ['Tenant must be archived before deletion review.'],
        counts: {
          activeUsers: 2,
          activeMemberships: 2,
          activeCredentials: 1,
          activeSubscriptions: 1,
          pendingApprovals: 0,
          pendingPackages: 0,
        },
      });
      return;
    }

    await json({});
  });
}

test('Commercial/Social product routes are wired with current UX vocabulary', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await installApiMocks(page);

  await page.goto('/login');
  await expect(page.getByRole('heading', { name: /Enter Commercial Workspace/i })).toBeVisible();
  await page.getByLabel(/Email/i).fill('admin@tanaghum.com');
  await page.getByRole('textbox', { name: /^Password$/i }).fill('password123');
  await page.getByRole('button', { name: /Open Command Center/i }).click();

  await expect(page.getByRole('heading', { name: /^Dashboard$/i })).toBeVisible();
  await expect(page.getByText(/Your Content Workflow/i)).toBeVisible();
  await expect(page.getByText(/Performance & Results/i)).toBeVisible();

  await page.locator('a[href="/ideas"]:visible').click();
  await expect(page.getByRole('heading', { name: /Content Creator/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Generate Campaign Ideas/i })).toBeVisible();

  await page.locator('a[href="/campaigns"]:visible').click();
  await expect(page.getByRole('heading', { name: /^Campaigns$/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /New Campaign/i })).toBeVisible();
  await expect(page.getByText(/Today's campaign step/i)).toBeVisible();
  await expect(page.getByText(/Workflow Guide/i)).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBe(true);

  await page.locator('a[href="/approvals"]:visible').click();
  await expect(page.getByRole('heading', { name: /Review & Approve/i })).toBeVisible();
  await expect(page.getByText(/How reviews work/i)).toBeVisible();

  await page.locator('a[href="/publishing"]:visible').click();
  await expect(page.getByRole('heading', { name: /Scheduling & Review/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Scheduling Payload/i })).toBeVisible();

  await page.locator('a[href="/analytics"]:visible').click();
  await expect(page.getByRole('heading', { name: /^Performance$/i })).toBeVisible();

  await page.locator('a[href="/tenant-admin"]:visible').click();
  await expect(page.getByRole('heading', { name: /Tenant Administration/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Subscription & Entitlements/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Tenant Export/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Deletion Readiness/i })).toBeVisible();

  expect(consoleErrors).toEqual([]);
});
