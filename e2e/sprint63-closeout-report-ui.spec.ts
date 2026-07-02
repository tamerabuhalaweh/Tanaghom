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
  name: 'Tagyeer wa Irtaqi - Closeout Event',
  eventType: 'tagyeer_wa_irtaqi',
  eventDate: '2026-08-01T12:00:00.000Z',
  location: 'Dubai',
  campaignStartDate: '2026-07-02T12:00:00.000Z',
  campaignEndDate: '2026-08-02T12:00:00.000Z',
  expectedAttendance: 200,
  revenueTarget: 120000,
  plannedBudget: 35000,
  ownerUserName: 'Admin User',
  status: 'completed',
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
  leadStatus: 'purchased',
  leadTemperature: 'buyer',
  audienceSource: 'follower',
  channelAttribution: 'instagram',
  platform: 'instagram',
  nextAction: 'Invite to next event.',
  createdAt: '2026-07-02T12:00:00.000Z',
};

const campaignRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Course launch awareness sequence',
  objective: 'Generate qualified event leads',
  platforms: ['instagram', 'email'],
  status: 'completed',
};

function dashboardBody() {
  return {
    event: eventRecord,
    kpis: {
      newLeads: 42,
      formCompletions: 80,
      meetingsBooked: 16,
      meetingsAttended: 10,
      purchases: 7,
      noShows: 3,
      plannedBudget: 35000,
      actualSpend: 8200,
      budgetVariance: 26800,
      reach: 5000,
      interactions: 640,
      interactionRate: 12.8,
    },
    funnel: [
      { label: 'Reach', value: 5000 },
      { label: 'Leads', value: 42 },
      { label: 'Meetings', value: 16 },
      { label: 'Purchases', value: 7 },
    ],
    channelPerformance: [],
    leadTemperature: [{ label: 'Buyer', value: 7 }],
    nextActions: [],
    kpiRecords: [],
    campaigns: [campaignRecord],
    leads: [leadRecord],
    sourceStatus: { manualRecords: 1, importedRecords: 0, connectorRecords: 0 },
  };
}

function populatedCloseoutReport() {
  return {
    event: {
      eventId: eventRecord.id,
      eventName: eventRecord.name,
      eventType: eventRecord.eventType,
      eventDate: eventRecord.eventDate,
      location: eventRecord.location,
      status: eventRecord.status,
      ownerName: 'Admin User',
      geography: eventRecord.geography,
      expectedAttendance: 200,
      revenueTarget: 120000,
      plannedBudget: 35000,
      campaignStartDate: eventRecord.campaignStartDate,
      campaignEndDate: eventRecord.campaignEndDate,
    },
    timeline: [
      { date: '2026-06-20T12:00:00.000Z', label: 'Event created', category: 'event' },
      { date: '2026-07-02T12:00:00.000Z', label: 'Campaign start', category: 'campaign' },
      { date: '2026-07-06T12:00:00.000Z', label: 'First lead captured', category: 'lead' },
      { date: '2026-08-01T12:00:00.000Z', label: 'Event date', category: 'event' },
    ],
    budget: {
      plannedBudget: 35000,
      knownSpend: 8200,
      budgetVariance: 26800,
      spendSource: 'kpi_records',
    },
    leadFunnel: {
      totalLeads: 42,
      byStatus: { purchased: 7, meeting_booked: 16, no_show: 3 },
      byTemperature: { buyer: 7, hot: 12, warm: 23 },
    },
    salesOutcomes: {
      meetingsBooked: 16,
      meetingsAttended: 10,
      noShows: 3,
      noShowRate: 0.1875,
      purchases: 7,
      revenue: 42000,
    },
    channelPerformance: [
      { channel: 'instagram', leads: 24, purchases: 5, spend: 5000 },
      { channel: 'email', leads: 10, purchases: 2, spend: 1200 },
    ],
    sourcePerformance: [
      { source: 'follower', leads: 28, purchases: 6 },
      { source: 'referral', leads: 8, purchases: 1 },
    ],
    topBarriers: [
      { id: '44444444-4444-4444-8444-444444444444', title: 'WhatsApp response delay', severity: 'high', category: 'sales', status: 'resolved', ownerRole: 'sales_manager' },
    ],
    campaigns: [{ id: campaignRecord.id, title: campaignRecord.title, status: 'completed', platforms: ['instagram'], createdAt: '2026-07-02T12:00:00.000Z' }],
    contentPackages: [{ id: 'package-1', packageStatus: 'prepared', packageType: 'social', createdAt: '2026-07-12T12:00:00.000Z' }],
    openFollowUps: [
      { type: 'sales_task', id: 'task-1', title: 'Call no-show leads', dueDate: '2026-08-03T12:00:00.000Z', ownerRole: 'sales_manager', severity: null },
    ],
    plannerSummary: { emailPlans: 2, whatsappPlans: 1, upsellPlans: 1, contentRequirements: 3, salesTasks: 4 },
    dataCompleteness: {
      hasKpiRecords: true,
      hasLeads: true,
      hasCampaigns: true,
      hasProblems: true,
      hasContentPackages: true,
      hasPlannerData: true,
      missingSections: [],
    },
  };
}

function emptyCloseoutReport() {
  return {
    event: { ...populatedCloseoutReport().event, eventName: 'Empty Closeout Event', plannedBudget: null, revenueTarget: null },
    timeline: [],
    budget: { plannedBudget: null, knownSpend: 0, budgetVariance: null, spendSource: 'none' },
    leadFunnel: { totalLeads: 0, byStatus: {}, byTemperature: {} },
    salesOutcomes: { meetingsBooked: 0, meetingsAttended: 0, noShows: 0, noShowRate: 0, purchases: 0, revenue: 0 },
    channelPerformance: [],
    sourcePerformance: [],
    topBarriers: [],
    campaigns: [],
    contentPackages: [],
    openFollowUps: [],
    plannerSummary: { emailPlans: 0, whatsappPlans: 0, upsellPlans: 0, contentRequirements: 0, salesTasks: 0 },
    dataCompleteness: {
      hasKpiRecords: false,
      hasLeads: false,
      hasCampaigns: false,
      hasProblems: false,
      hasContentPackages: false,
      hasPlannerData: false,
      missingSections: ['kpi_records', 'leads', 'campaigns', 'problems', 'content_packages', 'planner'],
    },
  };
}

async function installCloseoutMocks(page: Page, report: unknown) {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):4000\/.*/, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;
    const method = route.request().method();

    const json = async (body: unknown, status = 200) => {
      await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
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
      await json({ eventId: eventRecord.id, totalProblems: 1, openProblems: 0, criticalOpen: 0, byCategory: { sales: 1 }, topBlockers: [] });
      return;
    }

    if (pathname === '/event-problems' && method === 'GET') {
      await json([]);
      return;
    }

    if (pathname.startsWith(`/planner/events/${eventRecord.id}/`) && method === 'GET') {
      await json([]);
      return;
    }

    if (pathname === `/closeout/events/${eventRecord.id}/report` && method === 'GET') {
      await json(report);
      return;
    }

    await json({}, 404);
  });
}

async function openEvent(page: Page) {
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));
  await page.goto(`/events/${eventRecord.id}`);
  await expect(page.getByRole('heading', { name: /^Events$/i })).toBeVisible();
}

test('Sprint 63 closeout report renders populated event evidence and supports print', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  let printCalled = false;

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes(':4000') && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await installCloseoutMocks(page, populatedCloseoutReport());
  await page.addInitScript(() => {
    window.print = () => { window.dispatchEvent(new Event('afterprint')); };
  });
  page.on('dialog', dialog => dialog.dismiss().catch(() => undefined));
  await page.exposeFunction('recordPrintCall', () => { printCalled = true; });
  await page.addInitScript(() => {
    const originalPrint = window.print;
    window.print = () => {
      void (window as unknown as { recordPrintCall: () => Promise<void> }).recordPrintCall();
      originalPrint.call(window);
    };
  });

  await openEvent(page);
  await page.getByRole('button', { name: /Generate Report/i }).click();

  await expect(page.getByText(/Closeout report generated/i)).toBeVisible();
  await expect(page.getByText(/Executive closeout/i)).toBeVisible();
  await expect(page.getByText('Known Spend', { exact: true })).toBeVisible();
  await expect(page.locator('#closeout-report').getByText('8,200 SAR', { exact: true }).first()).toBeVisible();
  await expect(page.locator('#closeout-report').getByText('Lead Funnel', { exact: true }).last()).toBeVisible();
  await expect(page.locator('#closeout-report').getByText('Sales Outcomes', { exact: true }).last()).toBeVisible();
  await expect(page.locator('#closeout-report').getByText(/Top recorded signal: Instagram/i)).toBeVisible();
  await expect(page.locator('#closeout-report').getByText(/Top recorded signal: Follower/i)).toBeVisible();
  await expect(page.locator('#closeout-report').getByText(/WhatsApp response delay/i)).toBeVisible();
  await expect(page.locator('#closeout-report').getByText(/Call no-show leads/i)).toBeVisible();
  await expect(page.locator('#closeout-report').getByText(/Complete Evidence/i)).toBeVisible();

  await page.getByRole('button', { name: /Print \/ Save PDF/i }).click();
  await expect.poll(() => printCalled).toBe(true);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(eventRecord.id);
  expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(bodyText).not.toContain('tenantKey');
  expect(bodyText).not.toContain('{');
  expect(bodyText).not.toContain('}');
  expect(bodyText).not.toContain('kpi_records');
  expect(bodyText).not.toContain('lead_follow_up');
  expect(bodyText).not.toMatch(/\bROI\b|profit|successful|improved/i);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});

test('Sprint 63 closeout report labels missing data honestly', async ({ page }) => {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes(':4000') && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`);
  });

  await installCloseoutMocks(page, emptyCloseoutReport());
  await openEvent(page);
  await page.getByRole('button', { name: /Generate Report/i }).click();

  await expect(page.getByText(/Missing evidence: Kpi Records/i)).toBeVisible();
  await expect(page.getByText(/KPI Records: Missing/i)).toBeVisible();
  await expect(page.getByText(/Leads: Missing/i)).toBeVisible();
  await expect(page.getByText(/No timeline evidence is available yet/i)).toBeVisible();
  await expect(page.getByText(/No channel performance data is available yet/i)).toBeVisible();
  await expect(page.getByText(/No barriers were recorded for this event/i)).toBeVisible();
  await expect(page.getByText(/No open follow-up items are currently recorded/i)).toBeVisible();
  await expect(page.getByText(/Not available/i).first()).toBeVisible();

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(eventRecord.id);
  expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(bodyText).not.toContain('tenantKey');
  expect(bodyText).not.toContain('{');
  expect(bodyText).not.toContain('}');
  expect(bodyText).not.toMatch(/\bROI\b|profit|successful|improved/i);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});
