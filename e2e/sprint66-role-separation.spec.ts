import { expect, test, type Page } from '@playwright/test';

const eventId = '11111111-1111-4111-8111-111111111111';

const amroUser = {
  id: 'user-amro',
  email: 'amro.manager@tanaghum.com',
  name: 'Amro - Sales and Marketing Manager',
  role: 'department_head',
  tenantKey: 'default',
};

const adminUser = {
  id: 'user-admin',
  email: 'admin@tanaghum.com',
  name: 'Admin User',
  role: 'admin',
  tenantKey: 'default',
};

const amroAgentRep = {
  id: 'agent-rep-amro',
  name: 'Amro AgentRep',
  status: 'active',
  agentType: 'human',
  metadata: {
    roleTemplate: 'Marketing and Sales Manager',
    businessRole: 'marketing_sales_manager',
    role: 'department_head',
    departmentId: 'Customer Growth & Retention',
  },
  functionalAgents: [
    { name: 'Event Strategy', capability: 'commercial.event.strategy', status: 'active' },
    { name: 'Lead Follow-Up', capability: 'commercial.lead.lifecycle', status: 'active' },
  ],
  governanceAgents: [
    { name: 'Content Review', policyScope: ['campaign_review'], status: 'active' },
  ],
};

const eventRecord = {
  id: eventId,
  name: 'Tagyeer wa Irtaqi - Summer 2026',
  eventType: 'tagyeer_wa_irtaqi',
  eventDate: '2026-08-01T12:00:00.000Z',
  location: 'Dubai',
  campaignStartDate: '2026-07-02T12:00:00.000Z',
  campaignEndDate: null,
  expectedAttendance: 200,
  revenueTarget: 120000,
  plannedBudget: 35000,
  ownerUserName: 'Amro',
  status: 'active',
  offer: 'Two-day live transformation course.',
  audience: 'Warm followers and existing customers.',
  geography: 'GCC and Jordan',
  fomoAngle: 'Limited seats and date-based urgency.',
  selectedChannels: ['instagram', 'meta_ads', 'email', 'whatsapp'],
};

function eventDashboardBody() {
  return {
    event: eventRecord,
    kpis: {
      newLeads: 18,
      capturedLeads: 18,
      reportedLeads: 0,
      formCompletions: 11,
      meetingsBooked: 4,
      meetingsAttended: 2,
      purchases: 1,
      noShows: 1,
      noShowRate: 25,
      plannedBudget: eventRecord.plannedBudget,
      actualSpend: 5200,
      budgetVariance: eventRecord.plannedBudget - 5200,
      reach: 12000,
      impressions: 18000,
      interactions: 840,
      clicks: 210,
      interactionRate: 4.7,
      costPerLead: 288.89,
      costPerPurchase: 5200,
    },
    funnel: [
      { label: 'Reach', value: 12000 },
      { label: 'Forms', value: 11 },
      { label: 'Leads', value: 18 },
      { label: 'Meetings', value: 4 },
      { label: 'Purchases', value: 1 },
    ],
    channelPerformance: [],
    leadTemperature: [],
    nextActions: [],
    kpiRecords: [],
    campaigns: [],
    leads: [],
    sourceStatus: { manualRecords: 0, importedRecords: 0, connectorRecords: 0 },
  };
}

async function installRoleMocks(page: Page, user: typeof amroUser | typeof adminUser) {
  await page.addInitScript(() => window.localStorage.setItem('token', 'role-test-token'));

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
      await json({ user, agentRep: user.role === 'admin' ? { ...amroAgentRep, metadata: { role: 'admin' } } : amroAgentRep });
      return;
    }

    if (pathname === '/agent-reps/me') {
      await json(user.role === 'admin' ? { ...amroAgentRep, name: 'Admin AgentRep', metadata: { role: 'admin' } } : amroAgentRep);
      return;
    }

    if (pathname === '/events' && method === 'GET') {
      await json([eventRecord]);
      return;
    }

    if (pathname === `/events/${eventId}/dashboard`) {
      await json(eventDashboardBody());
      return;
    }

    if (pathname === '/connector-mappings') {
      await json([]);
      return;
    }

    if (pathname === `/event-problems/dashboard/${eventId}`) {
      await json({ totalOpen: 0, byCategory: {}, topBlockers: [] });
      return;
    }

    if (pathname.startsWith('/event-problems')) {
      await json([]);
      return;
    }

    if (pathname.startsWith('/planner/events/')) {
      await json([]);
      return;
    }

    if (pathname.startsWith('/learning-recommendations/events/')) {
      await json({ recommendations: [], summary: { total: 0 } });
      return;
    }

    if (pathname.startsWith('/leads')) {
      await json(pathname.includes('/dashboard/') ? { totalLeads: 0, byStatus: {} } : []);
      return;
    }

    await json({});
  });
}

test.describe('Sprint 66 role-specific workspace separation', () => {
  test('Amro manager workspace hides admin navigation and redirects admin URLs', async ({ page }) => {
    await installRoleMocks(page, amroUser);

    await page.goto('/my-agent-rep');
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    await expect(page.getByText('Marketing and Sales Manager').first()).toBeVisible();

    await expect(page.getByText('Admin & Settings')).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Users & Roles/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Tenant Admin/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Integrations/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Operations/i })).toHaveCount(0);

    await page.goto('/tenant-admin');
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();

    await page.goto('/admin-users');
    await expect(page).toHaveURL(/\/events$/);
    await expect(page.getByRole('heading', { name: 'Events' })).toBeVisible();
  });

  test('Admin workspace keeps the admin navigation available', async ({ page }) => {
    await installRoleMocks(page, adminUser);

    await page.goto('/my-agent-rep');
    await expect(page.getByRole('heading', { name: 'My Profile' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Admin & Settings/i })).toBeVisible();

    await page.getByRole('button', { name: /Admin & Settings/i }).click();
    await expect(page.getByRole('link', { name: /Users & Roles/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Tenant Admin/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Integrations/i })).toBeVisible();
  });
});
