import { expect, test, type Page } from '@playwright/test';

const eventId = '22222222-2222-4222-8222-222222222222';

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

const populatedDashboard = {
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
    lowestCostPerLeadEvent: { eventId, eventName: 'Business Camp - Riyadh', costPerLead: 92 },
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
      eventId: '33333333-3333-4333-8333-333333333333',
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

const emptyDashboard = {
  totalEvents: 0,
  filteredEvents: 0,
  totals: {
    totalLeads: 0,
    formCompletions: 0,
    meetingsBooked: 0,
    meetingsAttended: 0,
    noShows: 0,
    noShowRate: 0,
    purchases: 0,
    revenue: 0,
    revenueTarget: 0,
    plannedBudget: 0,
    actualSpend: 0,
    costPerLead: 0,
  },
  byEventType: {},
  byStatus: {},
  byGeography: {},
  byChannel: {},
  byAudienceSource: {},
  bestPerforming: {
    bestChannel: null,
    bestAudienceSource: null,
    highestRevenueEvent: null,
    lowestCostPerLeadEvent: null,
  },
  events: [],
};

async function installMasterDashboardMocks(page: Page, dashboard: unknown) {
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
      await json(dashboard);
      return;
    }

    if (pathname === '/events') {
      await json([]);
      return;
    }

    await json({});
  });
}

test('Sprint 63 master events dashboard shows executive portfolio metrics', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await installMasterDashboardMocks(page, populatedDashboard);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.goto('/events/master');

  await expect(page.getByRole('heading', { name: 'Business Control Room' })).toBeVisible();
  await expect(page.getByText('185').first()).toBeVisible();
  await expect(page.getByText(/AED\s*61,200/).first()).toBeVisible();
  await expect(page.getByText('Revenue Funnel')).toBeVisible();
  await expect(page.getByText('Channel Performance')).toBeVisible();
  await expect(page.getByText('Event Type Comparison')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Tagyeer wa Irtaqi - Dubai' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Instagram' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Open' }).first()).toBeVisible();

  const body = await page.locator('body').innerText();
  expect(body).not.toContain(eventId);
  expect(body).not.toContain('master_dashboard:read');
  expect(body).not.toContain('tenant_key');
  expect(consoleErrors).toEqual([]);
});

test('Sprint 63 master events dashboard shows honest empty state', async ({ page }) => {
  await installMasterDashboardMocks(page, emptyDashboard);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));
  await page.setViewportSize({ width: 1200, height: 900 });

  await page.goto('/events/master');

  await expect(page.getByRole('heading', { name: 'Business Control Room' })).toBeVisible();
  await expect(page.getByText('No event results yet')).toBeVisible();
  await expect(page.getByText(/without static sample numbers/i)).toBeVisible();
});
