import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const eventId = '22222222-2222-4222-8222-222222222222';
const evidenceDir = resolve(process.cwd(), 'docs', 'evidence', 'sprint-63-master-dashboard');

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

const events = [
  {
    id: eventId,
    name: 'Tagyeer wa Irtaqi - Dubai',
    eventType: 'tagyeer_wa_irtaqi',
    eventDate: '2026-08-12T12:00:00.000Z',
    location: 'Dubai',
    campaignStartDate: '2026-07-13T12:00:00.000Z',
    campaignEndDate: null,
    expectedAttendance: 220,
    revenueTarget: 120000,
    plannedBudget: 40000,
    ownerUserName: 'Amro',
    status: 'active',
    offer: 'Two-day live transformation course.',
    audience: 'Warm followers and existing course buyers.',
    geography: 'GCC and Jordan',
    fomoAngle: 'Limited seats and date-based urgency.',
    selectedChannels: ['instagram', 'meta_ads', 'email', 'whatsapp'],
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Business Camp - Riyadh',
    eventType: 'business_camp',
    eventDate: '2026-09-03T12:00:00.000Z',
    location: 'Riyadh',
    campaignStartDate: '2026-08-04T12:00:00.000Z',
    campaignEndDate: null,
    expectedAttendance: 90,
    revenueTarget: 60000,
    plannedBudget: 25000,
    ownerUserName: 'Amro',
    status: 'active',
    offer: 'Business growth camp for owners and managers.',
    audience: 'CEOs, founders, and business decision makers.',
    geography: 'Saudi Arabia',
    fomoAngle: 'Small cohort and high-touch access.',
    selectedChannels: ['instagram', 'youtube', 'email', 'whatsapp'],
  },
];

const masterDashboard = {
  totalEvents: 3,
  filteredEvents: 2,
  totals: {
    totalLeads: 185,
    formCompletions: 96,
    meetingsBooked: 42,
    meetingsAttended: 34,
    noShows: 8,
    noShowRate: 0.19,
    purchases: 17,
    revenue: 61200,
    revenueTarget: 180000,
    plannedBudget: 65000,
    actualSpend: 22400,
    costPerLead: 121.08,
  },
  byEventType: {
    tagyeer_wa_irtaqi: { events: 1, leads: 120, purchases: 12, revenue: 43200 },
    business_camp: { events: 1, leads: 65, purchases: 5, revenue: 18000 },
  },
  byStatus: {
    active: 2,
  },
  byGeography: {
    Dubai: { events: 1, leads: 120, revenue: 43200 },
    Riyadh: { events: 1, leads: 65, revenue: 18000 },
  },
  byChannel: {
    instagram: { leads: 110, purchases: 11, spend: 12800 },
    whatsapp: { leads: 44, purchases: 5, spend: 3600 },
    email: { leads: 31, purchases: 1, spend: 6000 },
  },
  byAudienceSource: {
    follower: { leads: 99, purchases: 12 },
    existing_customer: { leads: 54, purchases: 4 },
    referral: { leads: 32, purchases: 1 },
  },
  bestPerforming: {
    bestChannel: 'instagram',
    bestAudienceSource: 'follower',
    highestRevenueEvent: { eventId, eventName: 'Tagyeer wa Irtaqi - Dubai', revenue: 43200 },
    lowestCostPerLeadEvent: { eventId: events[1].id, eventName: 'Business Camp - Riyadh', costPerLead: 92 },
  },
  events: [
    {
      eventId,
      eventName: 'Tagyeer wa Irtaqi - Dubai',
      eventType: 'tagyeer_wa_irtaqi',
      eventDate: '2026-08-12T12:00:00.000Z',
      status: 'active',
      geography: 'Dubai',
      ownerName: 'Amro',
      totalLeads: 120,
      formCompletions: 64,
      meetingsBooked: 28,
      meetingsAttended: 24,
      noShows: 4,
      noShowRate: 0.14,
      purchases: 12,
      revenue: 43200,
      revenueTarget: 120000,
      plannedBudget: 40000,
      actualSpend: 12800,
      costPerLead: 106.67,
      bestChannel: 'instagram',
      bestAudienceSource: 'follower',
    },
    {
      eventId: events[1].id,
      eventName: 'Business Camp - Riyadh',
      eventType: 'business_camp',
      eventDate: '2026-09-03T12:00:00.000Z',
      status: 'active',
      geography: 'Riyadh',
      ownerName: 'Amro',
      totalLeads: 65,
      formCompletions: 32,
      meetingsBooked: 14,
      meetingsAttended: 10,
      noShows: 4,
      noShowRate: 0.29,
      purchases: 5,
      revenue: 18000,
      revenueTarget: 60000,
      plannedBudget: 25000,
      actualSpend: 9600,
      costPerLead: 147.69,
      bestChannel: 'whatsapp',
      bestAudienceSource: 'existing_customer',
    },
  ],
};

function eventDashboardBody() {
  return {
    event: events[0],
    kpis: {
      newLeads: 120,
      capturedLeads: 120,
      reportedLeads: 120,
      formCompletions: 64,
      meetingsBooked: 28,
      meetingsAttended: 24,
      purchases: 12,
      noShows: 4,
      noShowRate: 14.3,
      plannedBudget: 40000,
      actualSpend: 12800,
      budgetVariance: 27200,
      reach: 52000,
      impressions: 61000,
      interactions: 8400,
      clicks: 1900,
      interactionRate: 13.8,
      costPerLead: 106.67,
      costPerPurchase: 1066.67,
    },
    funnel: [
      { label: 'Reach', value: 52000 },
      { label: 'Interactions', value: 8400 },
      { label: 'Forms', value: 64 },
      { label: 'Leads', value: 120 },
      { label: 'Meetings', value: 28 },
      { label: 'Purchases', value: 12 },
    ],
    channelPerformance: [
      { channel: 'instagram', reach: 32000, interactions: 5400, leads: 72, purchases: 8, spend: 7600, conversionRate: 11.1 },
      { channel: 'whatsapp', reach: 9000, interactions: 1600, leads: 28, purchases: 3, spend: 1800, conversionRate: 10.7 },
      { channel: 'email', reach: 11000, interactions: 1400, leads: 20, purchases: 1, spend: 3400, conversionRate: 5 },
    ],
    leadTemperature: [
      { label: 'Cold', value: 20 },
      { label: 'Warm', value: 62 },
      { label: 'Hot', value: 26 },
      { label: 'Buyer', value: 12 },
      { label: 'No-show', value: 4 },
    ],
    nextActions: [
      {
        title: 'Reduce no-show risk',
        detail: 'Follow up with booked meetings before the event date.',
        priority: 'medium',
      },
    ],
    kpiRecords: [
      {
        id: 'kpi-1',
        metricDate: '2026-07-30T12:00:00.000Z',
        channel: 'instagram',
        reach: 32000,
        impressions: 39000,
        interactions: 5400,
        clicks: 1200,
        formCompletions: 40,
        leads: 72,
        meetingsBooked: 18,
        meetingsAttended: 15,
        purchases: 8,
        noShows: 3,
        spend: 7600,
        sourceType: 'manual',
      },
    ],
    campaigns: [],
    leads: [],
    sourceStatus: {
      manualRecords: 1,
      importedRecords: 0,
      connectorRecords: 0,
    },
  };
}

async function installVisualQaMocks(page: Page) {
  await page.route(/http:\/\/(127\.0\.0\.1|localhost):4000\/.*/, async (route) => {
    const url = new URL(route.request().url());
    const pathname = url.pathname;

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

    if (pathname === '/master-events/dashboard') {
      await json(masterDashboard);
      return;
    }

    if (pathname === '/events') {
      await json(events);
      return;
    }

    if (pathname === `/events/${eventId}/dashboard`) {
      await json(eventDashboardBody());
      return;
    }

    if (pathname === `/events/${eventId}/campaigns` || pathname === `/events/${eventId}/leads`) {
      await json([]);
      return;
    }

    if (pathname === '/leads') {
      await json([]);
      return;
    }

    await json({});
  });
}

async function openMasterDashboard(page: Page) {
  await installVisualQaMocks(page);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));
  await page.goto('/events/master');
  await expect(page.getByRole('heading', { name: 'Business Control Room' })).toBeVisible();
}

async function assertNoCustomerFacingLeaks(page: Page, failedRequests: string[], failedApiResponses: string[]) {
  const body = await page.locator('body').innerText();
  expect(body).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
  expect(body).not.toContain('tenant_key');
  expect(body).not.toContain('master_dashboard:read');
  expect(body).not.toContain('MCP');
  expect(body).not.toContain('SAIF');
  expect(body).not.toContain('M5');
  expect(body).not.toContain('AgentRep');
  expect(body).not.toContain('{"');
  expect(failedRequests).toEqual([]);
  expect(failedApiResponses).toEqual([]);
}

async function assertNoDocumentOverflow(page: Page) {
  const overflow = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(overflow.scrollWidth, `page overflowed horizontally: ${overflow.scrollWidth}px > ${overflow.clientWidth}px`).toBeLessThanOrEqual(overflow.clientWidth + 2);
}

test.describe('Sprint 63 master dashboard visual QA', () => {
  test.beforeAll(() => {
    mkdirSync(evidenceDir, { recursive: true });
  });

  for (const viewport of [
    { name: 'desktop', width: 1440, height: 1000 },
    { name: 'laptop', width: 1366, height: 768 },
    { name: 'mobile', width: 390, height: 844 },
  ]) {
    test(`captures readable ${viewport.name} evidence`, async ({ page }) => {
      const failedRequests: string[] = [];
      const failedApiResponses: string[] = [];
      const consoleErrors: string[] = [];

      page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}`));
      page.on('response', response => {
        if (response.url().includes(':4000') && response.status() >= 400) {
          failedApiResponses.push(`${response.status()} ${response.url()}`);
        }
      });
      page.on('console', (message) => {
        if (message.type() === 'error') consoleErrors.push(message.text());
      });
      page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));

      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await openMasterDashboard(page);

      await expect(page.getByText('Total Leads')).toBeVisible();
      await expect(page.getByText('Revenue Funnel')).toBeVisible();
      await expect(page.getByText('Channel Performance')).toBeVisible();
      await expect(page.getByText('Event Comparison')).toBeVisible();
      await assertNoDocumentOverflow(page);
      await assertNoCustomerFacingLeaks(page, failedRequests, failedApiResponses);
      expect(consoleErrors).toEqual([]);

      await page.screenshot({
        path: resolve(evidenceDir, `master-dashboard-${viewport.name}.jpg`),
        fullPage: true,
        type: 'jpeg',
        quality: 78,
      });
    });
  }

  test('drills from master dashboard into one event workspace without visual or API failures', async ({ page }) => {
    const failedRequests: string[] = [];
    const failedApiResponses: string[] = [];
    const consoleErrors: string[] = [];

    page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()}`));
    page.on('response', response => {
      if (response.url().includes(':4000') && response.status() >= 400) {
        failedApiResponses.push(`${response.status()} ${response.url()}`);
      }
    });
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', error => consoleErrors.push(`pageerror: ${error.message}`));

    await page.setViewportSize({ width: 1440, height: 1000 });
    await openMasterDashboard(page);
    await page.getByRole('row', { name: /Tagyeer wa Irtaqi - Dubai/i }).getByRole('button', { name: 'Open' }).click();

    await expect(page).toHaveURL(/\/events\/22222222-2222-4222-8222-222222222222$/);
    await expect(page.getByRole('heading', { name: 'Event Operations' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Selected event' })).toHaveValue('22222222-2222-4222-8222-222222222222');
    await expect(page.getByRole('heading', { name: 'What needs attention today' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Event workspace views' })).toBeVisible();
    await assertNoDocumentOverflow(page);
    await assertNoCustomerFacingLeaks(page, failedRequests, failedApiResponses);
    expect(consoleErrors).toEqual([]);

    await page.screenshot({
      path: resolve(evidenceDir, 'event-drilldown-desktop.jpg'),
      fullPage: true,
      type: 'jpeg',
      quality: 78,
    });
  });
});
