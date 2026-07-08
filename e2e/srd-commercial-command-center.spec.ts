import { expect, test, type Page } from '@playwright/test';

const user = {
  id: 'user-commercial-manager',
  email: 'commercial.manager@tanaghum.com',
  name: 'Commercial Manager',
  role: 'marketing_manager',
  tenantKey: 'default',
};

const agentRep = {
  id: 'agent-commercial-manager',
  name: 'Commercial Manager Profile',
  status: 'active',
  metadata: {
    roleTemplate: 'Commercial Manager',
    businessRole: 'commercial_manager',
  },
};

const liveEventLine = {
  id: 'line-live-event',
  revenueLineType: 'live_event',
  name: 'Live Events',
  description: 'Operate launches, events, leads, sales, and closeout learning.',
  status: 'active',
  configured: true,
  planCount: 1,
  openSignalCount: 1,
};

const onlineCourseLine = {
  id: 'line-online-course',
  revenueLineType: 'online_course',
  name: 'Online Courses',
  description: 'Plan course launches, enrollment funnels, follow-up, and retention.',
  status: 'active',
  configured: true,
  planCount: 0,
  openSignalCount: 0,
};

const linkedEvent = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Leadership Masterclass',
  eventDate: '2026-09-15T12:00:00.000Z',
  status: 'planning',
  plannedBudget: 18000,
  revenueTarget: 95000,
};

function baseDashboard() {
  return {
    revenueLines: [liveEventLine, onlineCourseLine],
    stageSummary: {
      assess: 1,
      strategy_planning: 1,
      implementation_engagement: 0,
    },
    rollups: {
      plannedRevenueTarget: 95000,
      knownRevenue: 0,
      knownSpend: 0,
      leads: 0,
      purchases: 0,
    },
  };
}

function lineDashboard(revenueLineType: string, planCreated: boolean) {
  const isCourse = revenueLineType === 'online_course';
  const revenueLine = isCourse ? onlineCourseLine : liveEventLine;
  return {
    revenueLine,
    rollups: {
      plannedRevenueTarget: isCourse ? (planCreated ? 125000 : 0) : 95000,
      knownRevenue: 0,
      knownSpend: isCourse ? 0 : 2400,
      leads: isCourse ? 0 : 14,
      purchases: isCourse ? 0 : 1,
      leadToPurchaseRate: isCourse ? null : 7.1,
      budgetVariance: isCourse ? null : 15600,
      costPerLead: isCourse ? null : 171.4,
      costPerPurchase: isCourse ? null : 2400,
      meetingsBooked: isCourse ? 0 : 3,
      noShows: isCourse ? 0 : 1,
    },
    dataStatus: {
      hasLinkedEvents: true,
      hasKpiRecords: !isCourse,
      hasLeadRecords: !isCourse,
      missingDataSources: isCourse ? ['GHL lead sync', 'Meta or YouTube analytics'] : ['GHL purchase sync'],
    },
    plans: planCreated && isCourse
      ? [{
          id: 'plan-online-course-growth',
          revenueLineId: onlineCourseLine.id,
          linkedEventId: linkedEvent.id,
          title: 'Q3 online course growth plan',
          horizon: 'quarterly',
          stage: 'strategy_planning',
          status: 'active',
          objective: 'Grow course enrollment from warm followers.',
          audience: 'Warm followers and existing customers.',
          budgetTarget: 25000,
          revenueTarget: 125000,
          actionPlan: 'Prepare content, email follow-up, and CRM handoff.',
        }]
      : [],
    linkedEvents: [linkedEvent],
    openSignals: isCourse ? [] : [{
      id: 'signal-1',
      title: 'CRM source is not connected',
      severity: 'risk',
      recommendedAction: 'Connect GHL before claiming purchase attribution.',
    }],
    nextAction: {
      label: isCourse ? 'Create a course launch plan' : 'Review commercial data readiness',
      description: isCourse
        ? 'Define the course offer, audience, budget, and linked event before execution starts.'
        : 'Confirm CRM and analytics sources before leadership reporting.',
      path: '/stitchi',
    },
  };
}

async function installCommercialMocks(page: Page) {
  let planCreated = false;
  let stitchiAsked = false;
  let actionStatus = 'awaiting_approval';
  const unexpectedRequests: string[] = [];
  const failedResponses: string[] = [];
  const consoleErrors: string[] = [];

  const stitchiAction = () => ({
    id: 'action-online-course-plan',
    actionType: 'create_commercial_plan_with_revenue_line',
    status: actionStatus,
    riskLevel: 'medium',
    requiresApproval: true,
    previewPayload: {
      revenueLineName: 'Online Courses',
      title: 'Leadership Course Launch',
      objective: 'sell to entrepreneurs.',
      audience: 'warm followers and previous buyers.',
      budgetTarget: 5000,
      revenueTarget: 30000,
      actionPlan: 'content, ads, GHL follow-up, WhatsApp reminders.',
      linkedEventName: 'Leadership Masterclass',
      aiAssisted: true,
      aiProvider: 'gemma',
      aiModel: 'gemma4-26b-a4b-canary',
      aiSummary: 'AI-assisted launch plan for warm followers and previous buyers.',
      contentPillars: ['authority content', 'entrepreneur proof story'],
      channelPlan: ['content warm-up', 'GHL follow-up preparation'],
      successMetrics: ['qualified leads', 'purchase conversion'],
      externalExecution: 'blocked',
      approvalRequired: true,
    },
    resultPayload: actionStatus === 'completed'
      ? {
          objectType: 'commercial_plan',
          objectId: 'plan-online-course-growth',
          externalExecution: 'blocked',
        }
      : null,
  });

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

    const json = async (body: unknown, status = 200) => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });
    };

    if (pathname === '/auth/login' && method === 'POST') {
      await json({ token: 'commercial-manager-token', user, agentRep });
      return;
    }

    if (pathname === '/auth/session') {
      await json({ user, agentRep });
      return;
    }

    if (pathname === '/commercial-command-center/dashboard') {
      await json(baseDashboard());
      return;
    }

    if (pathname === '/commercial-command-center/revenue-lines/online_course/dashboard') {
      await json(lineDashboard('online_course', planCreated));
      return;
    }

    if (pathname === '/commercial-command-center/revenue-lines/live_event/dashboard') {
      await json(lineDashboard('live_event', planCreated));
      return;
    }

    if (pathname === '/commercial-command-center/plans' && method === 'POST') {
      planCreated = true;
      await json({
        id: 'plan-online-course-growth',
        revenueLineId: onlineCourseLine.id,
        status: 'active',
      }, 201);
      return;
    }

    if (pathname === '/stitchi/conversations' && method === 'GET') {
      await json([]);
      return;
    }

    if (pathname === '/stitchi/conversations' && method === 'POST') {
      await json({ id: 'conversation-commercial', title: 'Daily work with Stitchi' }, 201);
      return;
    }

    if (pathname === '/stitchi/conversations/conversation-commercial/messages' && method === 'GET') {
      await json(stitchiAsked ? [{
        id: 'message-assistant',
        role: 'assistant',
        content: 'I prepared this for review: configure Online Courses and create a commercial plan.\nNo data has been changed yet.\nA manager must approve it before Tanaghum executes the internal update.',
      }] : []);
      return;
    }

    if (pathname === '/stitchi/conversations/conversation-commercial/actions' && method === 'GET') {
      await json(stitchiAsked ? [stitchiAction()] : []);
      return;
    }

    if (pathname === '/stitchi/conversations/conversation-commercial/orchestrate' && method === 'POST') {
      stitchiAsked = true;
      actionStatus = 'awaiting_approval';
      await json({
        status: 'action_proposed',
        userMessage: {
          id: 'message-user',
          role: 'user',
          content: 'Create an Online Courses plan for a leadership course launch.',
        },
        assistantMessage: {
          id: 'message-assistant',
          role: 'assistant',
          content: 'I prepared this for review: configure Online Courses and create a commercial plan.\nNo data has been changed yet.\nA manager must approve it before Tanaghum executes the internal update.',
        },
        actionRun: stitchiAction(),
        safety: {
          approvalRequired: true,
          writesExecuted: false,
          externalExecution: 'blocked',
        },
      }, 201);
      return;
    }

    if (pathname === '/stitchi/actions/action-online-course-plan/approve-and-execute' && method === 'POST') {
      actionStatus = 'completed';
      planCreated = true;
      await json({
        approval: { decision: 'approved' },
        actionRun: stitchiAction(),
        executed: {
          objectType: 'commercial_plan',
          objectId: 'plan-online-course-growth',
          result: { id: 'plan-online-course-growth' },
        },
      });
      return;
    }

    if (pathname === '/stitchi/conversations/conversation-commercial/respond/stream' && method === 'POST') {
      stitchiAsked = true;
      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: 'event: stitchi.token\ndata: {"text":"Focus next on the online course plan and missing data sources."}\n\n',
      });
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
      expect(unexpectedRequests, 'Commercial workflow should not call unrelated or admin APIs').toEqual([]);
      expect(failedResponses, 'Commercial workflow should not have failed API responses').toEqual([]);
      expect(consoleErrors, 'Commercial workflow should not log browser errors').toEqual([]);
    },
  };
}

test.describe('SRD Commercial Command Center closure workflow', () => {
  test('commercial manager can plan a revenue line and ask Stitchi without hidden admin failures', async ({ page }) => {
    const monitor = await installCommercialMocks(page);

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
    await page.getByRole('textbox', { name: 'Password' }).fill('password123');
    await page.getByRole('button', { name: 'Open Command Center' }).click();

    await page.waitForURL(/\/command-center(?:$|[?#])/);
    await expect(page.getByRole('heading', { name: /Run the commercial business lines/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Revenue lines' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Users & Roles/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Tenant Admin/i })).toHaveCount(0);
    await expect(page.getByText(/\b(Sprint\s*\d+|Acceptance|STITCH|SAIF|MCP|M5)\b/i)).toHaveCount(0);

    await page.getByRole('button', { name: /Online Courses/i }).click();
    await expect(page.getByRole('heading', { name: 'Online Courses' })).toBeVisible();
    await expect(page.getByText('GHL lead sync')).toBeVisible();

    await page.getByLabel('Plan title').fill('Q3 online course growth plan');
    await page.getByLabel('Linked event').selectOption(linkedEvent.id);
    await page.getByLabel('Status').selectOption('active');
    await page.getByLabel('Budget target').fill('25000');
    await page.getByLabel('Revenue target').fill('125000');
    await page.getByLabel('Objective').fill('Grow course enrollment from warm followers.');
    await page.getByLabel('Audience').fill('Warm followers and existing customers.');
    await page.getByLabel('Action plan').fill('Prepare content, email follow-up, and CRM handoff.');
    await page.getByRole('button', { name: 'Create plan' }).click();

    await expect(page.getByText('Commercial plan created.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Q3 online course growth plan/i })).toBeVisible();
    await expect(page.getByText('Leadership Masterclass').last()).toBeVisible();

    await page.getByRole('button', { name: 'Ask Stitchi' }).first().click();
    await expect(page).toHaveURL(/\/stitchi(?:$|[?#])/);
    await expect(page.getByRole('heading', { name: /Tell Stitchi what work you want done/i })).toBeVisible();
    await page.getByPlaceholder(/What should I focus/i).fill([
      'Stitchi, create an Online Courses plan for a leadership course launch.',
      'Objective: sell to entrepreneurs.',
      'Audience: warm followers and previous buyers.',
      'Budget target: 5000.',
      'Revenue target: 30000.',
      'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
      'Link it to the next available live event if suitable.',
    ].join('\n'));
    await page.getByRole('button', { name: 'Ask Stitchi' }).click();
    await expect(page.getByText(/I prepared this for review/i)).toBeVisible();
    await expect(page.getByText('Online Courses').last()).toBeVisible();
    await expect(page.getByText('Leadership Course Launch').last()).toBeVisible();
    await expect(page.getByText(/gemma4-26b-a4b-canary/i).last()).toBeVisible();
    await expect(page.getByText(/authority content/i).last()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve & Save' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Approve & Save' }).first().click();
    await expect(page.getByText('Saved to Tanaghum. The workspace has been refreshed.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Open Commercial Command Center' }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Open Commercial Command Center' }).first().click();
    await expect(page).toHaveURL(/\/command-center(?:$|[?#])/);
    await page.getByRole('button', { name: /Online Courses/i }).click();
    await expect(page.getByRole('button', { name: /Q3 online course growth plan/i })).toBeVisible();

    monitor.assertClean();
  });
});
