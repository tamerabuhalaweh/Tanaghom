import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const acceptanceEnabled = process.env.E2E_PRODUCTION_ACCEPTANCE === 'true';
const apiBase = process.env.E2E_API_BASE_URL || 'http://127.0.0.1:4000';
const campaignId = '91000000-0000-4000-8000-000000000001';
const contentItemId = '91000000-0000-4000-8000-000000000002';

type LoginSession = {
  token: string;
  user: { id: string; role: string; agentRepId: string | null; tenantKey: string };
};

async function login(request: APIRequestContext, email: string, password: string): Promise<LoginSession> {
  const response = await request.post(`${apiBase}/auth/login`, { data: { email, password } });
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json() as Promise<LoginSession>;
}

function auth(token: string) {
  return { Authorization: `Bearer ${token}` };
}

async function expectOk(response: Awaited<ReturnType<APIRequestContext['get']>>) {
  expect(response.ok(), await response.text()).toBeTruthy();
  return response.json();
}

async function loginInBrowser(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Open Command Center' }).click();
  await expect(page).toHaveURL(/\/(command-center)?$/);
}

test.describe('Hybrid production acceptance harness', () => {
  test.skip(!acceptanceEnabled, 'Set E2E_PRODUCTION_ACCEPTANCE=true on an isolated acceptance database.');
  test.describe.configure({ mode: 'serial' });

  test('persists governed work across Stitchi, approvals, packaging, UI, and tenant boundaries', async ({ request, page }) => {
    const manager = await login(request, 'brand.head@tanaghum.com', 'password123');
    const cco = await login(request, 'cco@tanaghum.com', 'password123');
    const otherTenant = await login(request, 'acceptance.other@tanaghum.test', 'acceptance-password-123');
    expect(manager.user.tenantKey).toBe('default');
    expect(otherTenant.user.tenantKey).toBe('acceptance-isolation');

    const suffix = Date.now().toString();
    const eventName = `Leadership Operating Plan ${suffix}`;
    const revenueLineName = `Acceptance Community ${suffix}`;
    const planTitle = `Leadership Course Plan ${suffix}`;

    const eventResponse = await request.post(`${apiBase}/events`, {
      headers: auth(manager.token),
      data: {
        name: eventName,
        eventType: 'virtual_event',
        eventDate: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString(),
        location: 'Online',
        expectedAttendance: 150,
        revenueTarget: 30000,
        plannedBudget: 5000,
        offer: 'Leadership course for entrepreneurs',
        audience: 'Warm followers and previous buyers',
        selectedChannels: ['content', 'ads', 'ghl', 'whatsapp'],
      },
    });
    const event = await expectOk(eventResponse) as { id: string };

    const conversationResponse = await request.post(`${apiBase}/stitchi/conversations`, {
      headers: auth(manager.token),
      data: { title: `Prepare ${planTitle}`, eventId: event.id },
    });
    const conversation = await expectOk(conversationResponse) as { id: string };

    const actionResponse = await request.post(`${apiBase}/stitchi/conversations/${conversation.id}/actions`, {
      headers: auth(manager.token),
      data: {
        actionType: 'create_commercial_plan_with_revenue_line',
        inputPayload: {
          revenueLine: {
            revenueLineType: 'loyalty_community',
            name: revenueLineName,
            description: 'Acceptance-only revenue line for the isolated CI database.',
          },
          plan: {
            linkedEventId: event.id,
            horizon: 'product_or_event',
            stage: 'strategy_planning',
            title: planTitle,
            objective: 'Sell a leadership course to qualified entrepreneurs.',
            audience: 'Warm followers and previous buyers.',
            currency: 'USD',
            budgetTarget: 5000,
            revenueTarget: 30000,
            strategySummary: 'Use trusted content and governed retargeting.',
            actionPlan: 'Content, ads, GHL follow-up, and WhatsApp reminders.',
          },
        },
        previewPayload: { title: planTitle, externalExecution: 'blocked' },
        riskLevel: 'medium',
      },
    });
    const action = await expectOk(actionResponse) as { id: string; status: string; requiresApproval: boolean };
    expect(action.requiresApproval).toBe(true);
    expect(action.status).toMatch(/proposed|awaiting_approval/);

    const plansBeforeApproval = await expectOk(await request.get(`${apiBase}/commercial-command-center/plans`, {
      headers: auth(manager.token),
    })) as Array<{ title: string }>;
    expect(plansBeforeApproval.some(plan => plan.title === planTitle)).toBe(false);

    const unauthorizedApproval = await request.post(`${apiBase}/stitchi/actions/${action.id}/approve-and-execute`, {
      headers: auth(manager.token),
      data: { notes: 'A manager must not self-approve governed work.' },
    });
    expect(unauthorizedApproval.status()).toBe(403);

    const approvedAction = await request.post(`${apiBase}/stitchi/actions/${action.id}/approve-and-execute`, {
      headers: auth(cco.token),
      data: { notes: 'Approved in the isolated production acceptance workflow.' },
    });
    const actionResult = await expectOk(approvedAction) as {
      actionRun: { status: string; resultPayload: Record<string, unknown> };
      executed: { objectType: string; objectId: string };
    };
    expect(actionResult.actionRun.status).toBe('completed');
    expect(actionResult.executed.objectType).toBe('commercial_plan');

    const plansAfterApproval = await expectOk(await request.get(`${apiBase}/commercial-command-center/plans`, {
      headers: auth(manager.token),
    })) as Array<{ title: string; linkedEventId: string }>;
    expect(plansAfterApproval).toContainEqual(expect.objectContaining({ title: planTitle, linkedEventId: event.id }));

    const approvalResponse = await request.post(`${apiBase}/approvals`, {
      headers: auth(manager.token),
      data: {
        targetType: 'content_item',
        targetId: contentItemId,
        approvalType: 'cco_review',
        riskCategory: 'low',
        requiredRole: 'cco',
        comment: 'Review the production acceptance content fixture.',
      },
    });
    const approval = await expectOk(approvalResponse) as { id: string; approvalStatus: string };
    expect(approval.approvalStatus).toBe('pending');

    const managerDecision = await request.post(`${apiBase}/approvals/${approval.id}/approve`, {
      headers: auth(manager.token),
      data: { decision: 'approved', comment: 'Self-approval must be denied.' },
    });
    expect(managerDecision.status()).toBe(403);

    const approvalDecision = await request.post(`${apiBase}/approvals/${approval.id}/approve`, {
      headers: auth(cco.token),
      data: { decision: 'approved', comment: 'Content is suitable for governed package preparation.' },
    });
    const approved = await expectOk(approvalDecision) as { approvalStatus: string };
    expect(approved.approvalStatus).toBe('approved');

    const packageResponse = await request.post(`${apiBase}/publishing-package/create`, {
      headers: auth(cco.token),
      data: {
        campaignId,
        draftId: contentItemId,
        approvalId: approval.id,
        platforms: ['instagram'],
        scheduledTime: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      },
    });
    const publishingPackage = await expectOk(packageResponse) as {
      id: string;
      executionBoundary: Record<string, boolean>;
      status: string;
    };
    expect(publishingPackage.status).toBe('ready');
    expect(publishingPackage.executionBoundary).toEqual({
      externalExecutionEnabled: false,
      postizLiveEnabled: false,
      m5WriteExecutionEnabled: false,
    });

    const evidence = await expectOk(await request.get(`${apiBase}/commercial-workflow/evidence?campaignId=${campaignId}`, {
      headers: auth(manager.token),
    })) as {
      actions: Array<{ action: string }>;
      safety: { externalWritesBlocked: boolean; m5Disabled: boolean };
    };
    expect(evidence.actions.map(item => item.action)).toEqual(expect.arrayContaining([
      'approval_submitted',
      'approval_decided',
      'publishing_package_created',
    ]));
    expect(evidence.safety).toEqual({ externalWritesBlocked: true, m5Disabled: true });

    const otherPlans = await expectOk(await request.get(`${apiBase}/commercial-command-center/plans`, {
      headers: auth(otherTenant.token),
    })) as Array<{ title: string }>;
    expect(otherPlans.some(plan => plan.title === planTitle)).toBe(false);
    expect((await request.get(`${apiBase}/stitchi/conversations/${conversation.id}`, { headers: auth(otherTenant.token) })).status()).toBe(404);
    expect((await request.get(`${apiBase}/approvals/${approval.id}`, { headers: auth(otherTenant.token) })).status()).toBe(404);
    const otherPackages = await expectOk(await request.get(`${apiBase}/publishing-package/list`, {
      headers: auth(otherTenant.token),
    })) as Array<{ id: string }>;
    expect(otherPackages.some(item => item.id === publishingPackage.id)).toBe(false);
    const otherAudit = await expectOk(await request.get(`${apiBase}/observability/audit?objectId=${publishingPackage.id}`, {
      headers: auth(otherTenant.token),
    })) as Array<{ targetObjectId: string }>;
    expect(otherAudit.some(item => item.targetObjectId === publishingPackage.id)).toBe(false);

    const browserProblems: string[] = [];
    const failedApiResponses: string[] = [];
    page.on('console', message => {
      if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(`${message.type()}: ${message.text()}`);
    });
    page.on('pageerror', error => browserProblems.push(`pageerror: ${error.message}`));
    page.on('response', response => {
      if (response.status() >= 400 && response.url().startsWith(apiBase)) {
        failedApiResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await loginInBrowser(page, 'brand.head@tanaghum.com', 'password123');
    await page.goto('/commercial-plans');
    await page.locator('summary').filter({ hasText: 'Future revenue lines' }).click();
    await page.getByRole('button', { name: revenueLineName }).click();
    await expect(page.getByRole('heading', { name: planTitle, exact: true })).toBeVisible();
    await page.goto('/scheduling');
    await expect(page.getByText(/Production acceptance leadership campaign/i).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(browserProblems).toEqual([]);
    expect(failedApiResponses).toEqual([]);
  });
});
