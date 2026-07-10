import { expect, test, type Page } from '@playwright/test';

const adminUser = {
  id: 'user-1',
  email: 'admin@tanaghum.com',
  name: 'Admin User',
  role: 'admin',
  tenantKey: 'default',
};

const agentRep = {
  id: 'agent-rep-1',
  role: 'admin',
  department: 'Commercial',
};

const eventRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Tagyeer wa Irtaqi - Problem Log Event',
  eventType: 'tagyeer_wa_irtaqi',
  eventDate: '2026-08-01T12:00:00.000Z',
  location: 'Dubai',
  campaignStartDate: '2026-07-02T12:00:00.000Z',
  campaignEndDate: null,
  expectedAttendance: 200,
  revenueTarget: 120000,
  plannedBudget: 35000,
  ownerUserName: 'Admin User',
  status: 'active',
  offer: 'Two-day live transformation course.',
  audience: 'Warm followers and existing customers.',
  geography: 'GCC and Jordan',
  fomoAngle: 'Limited seats and date-based urgency.',
  selectedChannels: ['instagram', 'meta_ads', 'email', 'whatsapp'],
};

const leadRecord = {
  id: '22222222-2222-4222-8222-222222222222',
  leadName: 'Ahmed Al-Rashid',
  leadEmail: 'ahmed@example.com',
  leadPhone: '+966500000000',
  leadStatus: 'contacted',
  leadTemperature: 'warm',
  audienceSource: 'follower',
  channelAttribution: 'instagram',
  platform: 'instagram',
  nextAction: 'Confirm event package.',
  createdAt: '2026-07-02T12:00:00.000Z',
};

const campaignRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Course launch awareness sequence',
  objective: 'Generate qualified event leads',
  platforms: ['instagram', 'email'],
  status: 'active',
};

type ProblemRecord = {
  id: string;
  tenantKey: string;
  eventId: string;
  title: string;
  description: string | null;
  category: string;
  severity: string;
  status: string;
  source: string;
  impactSummary: string | null;
  recommendedAction: string | null;
  ownerRole: string | null;
  relatedLeadId: string | null;
  relatedCampaignId: string | null;
  dueDate: string | null;
  resolutionNotes: string | null;
  createdByUserId: string;
  resolvedByUserId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function dashboardBody() {
  return {
    event: eventRecord,
    kpis: {
      newLeads: 42,
      capturedLeads: 1,
      reportedLeads: 42,
      formCompletions: 80,
      meetingsBooked: 16,
      meetingsAttended: 10,
      purchases: 7,
      noShows: 3,
      noShowRate: 18.8,
      plannedBudget: 35000,
      actualSpend: 2800,
      budgetVariance: 32200,
      reach: 5000,
      impressions: 6200,
      interactions: 640,
      clicks: 220,
      interactionRate: 10.3,
      costPerLead: 66.67,
      costPerPurchase: 400,
    },
    funnel: [
      { label: 'Reach', value: 5000 },
      { label: 'Interactions', value: 640 },
      { label: 'Forms', value: 80 },
      { label: 'Leads', value: 42 },
      { label: 'Meetings', value: 16 },
      { label: 'Purchases', value: 7 },
    ],
    channelPerformance: [],
    leadTemperature: [
      { label: 'Warm', value: 1 },
      { label: 'Buyer', value: 7 },
    ],
    nextActions: [],
    kpiRecords: [],
    campaigns: [campaignRecord],
    leads: [leadRecord],
    sourceStatus: {
      manualRecords: 1,
      importedRecords: 0,
      connectorRecords: 0,
    },
  };
}

function problemDashboard(problems: ProblemRecord[]) {
  const active = problems.filter(problem => problem.status === 'open' || problem.status === 'investigating');
  const bySeverity = { low: 0, medium: 0, high: 0, critical: 0 };
  const byStatus = { open: 0, investigating: 0, resolved: 0, dismissed: 0 };
  const byCategory: Record<string, number> = {};

  for (const problem of problems) {
    bySeverity[problem.severity as keyof typeof bySeverity] += 1;
    byStatus[problem.status as keyof typeof byStatus] += 1;
    byCategory[problem.category] = (byCategory[problem.category] || 0) + 1;
  }

  return {
    eventId: eventRecord.id,
    totalProblems: problems.length,
    openProblems: active.length,
    criticalOpen: active.filter(problem => problem.severity === 'critical').length,
    bySeverity,
    byStatus,
    byCategory,
    topBlockers: active.slice(0, 5).map(problem => ({
      id: problem.id,
      title: problem.title,
      severity: problem.severity,
      category: problem.category,
      ownerRole: problem.ownerRole,
    })),
  };
}

async function installProblemLogMocks(page: Page) {
  let problems: ProblemRecord[] = [
    {
      id: '44444444-4444-4444-8444-444444444444',
      tenantKey: 'default',
      eventId: eventRecord.id,
      title: 'Ad spend high but form completion low',
      description: 'Meta spend is increasing while form completion is flat.',
      category: 'funnel',
      severity: 'high',
      status: 'open',
      source: 'kpi_review',
      impactSummary: 'Potential budget waste before the event deadline.',
      recommendedAction: 'Review landing form friction and test shorter copy.',
      ownerRole: 'marketing_manager',
      relatedLeadId: null,
      relatedCampaignId: campaignRecord.id,
      dueDate: null,
      resolutionNotes: null,
      createdByUserId: adminUser.id,
      resolvedByUserId: null,
      resolvedAt: null,
      createdAt: '2026-07-02T12:00:00.000Z',
      updatedAt: '2026-07-02T12:00:00.000Z',
    },
  ];

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

    if (pathname === '/auth/session') {
      await json({ user: adminUser, agentRep });
      return;
    }

    if (pathname === '/events' && method === 'GET') {
      await json([eventRecord]);
      return;
    }

    if (pathname === `/events/${eventRecord.id}/dashboard`) {
      await json(dashboardBody());
      return;
    }

    if (pathname === '/leads' && method === 'GET') {
      await json([leadRecord]);
      return;
    }

    if (pathname === `/event-problems/dashboard/${eventRecord.id}` && method === 'GET') {
      await json(problemDashboard(problems));
      return;
    }

    if (pathname === '/event-problems' && method === 'GET') {
      await json(problems);
      return;
    }

    if (pathname === '/event-problems' && method === 'POST') {
      const body = route.request().postDataJSON() as Partial<ProblemRecord>;
      const created: ProblemRecord = {
        id: `55555555-5555-4555-8555-55555555555${problems.length}`,
        tenantKey: 'default',
        eventId: String(body.eventId || eventRecord.id),
        title: String(body.title || 'Untitled barrier'),
        description: body.description ? String(body.description) : null,
        category: String(body.category || 'sales'),
        severity: String(body.severity || 'medium'),
        status: 'open',
        source: String(body.source || 'manual'),
        impactSummary: body.impactSummary ? String(body.impactSummary) : null,
        recommendedAction: body.recommendedAction ? String(body.recommendedAction) : null,
        ownerRole: body.ownerRole ? String(body.ownerRole) : null,
        relatedLeadId: body.relatedLeadId ? String(body.relatedLeadId) : null,
        relatedCampaignId: body.relatedCampaignId ? String(body.relatedCampaignId) : null,
        dueDate: body.dueDate ? String(body.dueDate) : null,
        resolutionNotes: null,
        createdByUserId: adminUser.id,
        resolvedByUserId: null,
        resolvedAt: null,
        createdAt: '2026-07-02T12:10:00.000Z',
        updatedAt: '2026-07-02T12:10:00.000Z',
      };
      problems = [created, ...problems];
      await json(created, 201);
      return;
    }

    const updateMatch = pathname.match(/^\/event-problems\/([^/]+)$/);
    if (updateMatch && method === 'PUT') {
      const id = updateMatch[1];
      const body = route.request().postDataJSON() as Partial<ProblemRecord>;
      problems = problems.map(problem => problem.id === id ? { ...problem, ...body, updatedAt: '2026-07-02T12:20:00.000Z' } : problem);
      await json(problems.find(problem => problem.id === id));
      return;
    }

    const transitionMatch = pathname.match(/^\/event-problems\/([^/]+)\/transition$/);
    if (transitionMatch && method === 'POST') {
      const id = transitionMatch[1];
      const body = route.request().postDataJSON() as { toStatus: string; resolutionNotes?: string };
      problems = problems.map(problem => problem.id === id ? {
        ...problem,
        status: body.toStatus,
        resolutionNotes: body.resolutionNotes || problem.resolutionNotes,
        resolvedByUserId: body.toStatus === 'resolved' || body.toStatus === 'dismissed' ? adminUser.id : problem.resolvedByUserId,
        resolvedAt: body.toStatus === 'resolved' || body.toStatus === 'dismissed' ? '2026-07-02T12:30:00.000Z' : problem.resolvedAt,
        updatedAt: '2026-07-02T12:30:00.000Z',
      } : problem);
      await json(problems.find(problem => problem.id === id));
      return;
    }

    await json({});
  });
}

test('Sprint 63C event barriers are visible and actionable from the event dashboard', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes(':4000') && response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  await installProblemLogMocks(page);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));

  await page.goto(`/events/advanced/${eventRecord.id}`);

  await expect(page.getByRole('heading', { name: /^Events$/i })).toBeVisible();
  await expect(page.getByText(/Barriers & Risks/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Ad spend high but form/i })).toBeVisible();
  await expect(page.getByText(/1 active/i)).toBeVisible();

  await page.getByLabel(/Blocker title/i).fill('WhatsApp follow-up delay over 24 hours');
  await page.getByRole('combobox', { name: /^Area$/i }).selectOption('sales');
  await page.getByRole('combobox', { name: /^Severity$/i }).first().selectOption('critical');
  await page.getByLabel(/What happened/i).fill('Sales team is replying to qualified WhatsApp leads too late.');
  await page.getByLabel(/Business impact/i).fill('Hot leads may cool down before a meeting is booked.');
  await page.getByLabel(/Recommended action/i).first().fill('Assign same-day callback owner and test a shorter reply script.');
  await page.getByRole('combobox', { name: /Related lead/i }).selectOption(leadRecord.id);
  await page.getByRole('button', { name: /Record Blocker/i }).click();

  await expect(page.getByText(/Barrier recorded for this event/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /WhatsApp follow-up delay over/i })).toBeVisible();
  await expect(page.getByText(/2 active/i)).toBeVisible();
  await expect(page.getByText(/1 critical/i)).toBeVisible();

  await page.getByRole('button', { name: /WhatsApp follow-up delay over/i }).click();
  await page.getByRole('textbox', { name: /^Impact$/i }).fill('Sales response SLA is now visible to the event owner.');
  await page.getByRole('textbox', { name: /Recommended action/i }).last().fill('Assign the sales manager and check responses twice daily.');
  await page.getByRole('button', { name: /Save Update/i }).click();

  await expect(page.getByText(/Barrier action plan updated/i)).toBeVisible();

  await page.getByRole('textbox', { name: /Resolution note/i }).fill('Sales manager assigned same-day follow-up and response script.');
  await page.getByRole('button', { name: /^Resolve$/i }).click();

  await expect(page.getByText(/Barrier marked Resolved/i)).toBeVisible();
  await expect(page.getByText(/Resolved/i).first()).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(eventRecord.id);
  expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(bodyText).not.toContain('{');
  expect(bodyText).not.toContain('tenantKey');
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});
