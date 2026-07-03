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
  name: 'Tagyeer wa Irtaqi - Planner Event',
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

const campaignRecord = {
  id: '33333333-3333-4333-8333-333333333333',
  title: 'Course launch awareness sequence',
  objective: 'Generate qualified event leads',
  platforms: ['instagram', 'email'],
  status: 'active',
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

type PlannerRecord = Record<string, unknown> & { id: string; eventId: string };

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

async function installPlannerMocks(page: Page) {
  const counters = {
    email: 1,
    whatsapp: 1,
    upsell: 1,
    content: 1,
    task: 1,
  };

  let emailPlans: PlannerRecord[] = [];
  let whatsappPlans: PlannerRecord[] = [];
  let upsellPlans: PlannerRecord[] = [];
  let contentRequirements: PlannerRecord[] = [];
  let salesTasks: PlannerRecord[] = [];

  const routeCollection = async (
    route: Parameters<Parameters<Page['route']>[1]>[0],
    collection: PlannerRecord[],
    setCollection: (items: PlannerRecord[]) => void,
    prefix: keyof typeof counters,
  ) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    const created = {
      ...body,
      id: `${prefix}-${counters[prefix]++}`,
      eventId: String(body.eventId || eventRecord.id),
      approvalStatus: body.approvalStatus || 'draft',
      status: body.status || 'pending',
      createdAt: '2026-07-02T12:00:00.000Z',
      updatedAt: '2026-07-02T12:00:00.000Z',
    } as PlannerRecord;
    setCollection([created, ...collection]);
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify(created) });
  };

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
      await json({ eventId: eventRecord.id, totalProblems: 0, openProblems: 0, criticalOpen: 0, byCategory: {}, topBlockers: [] });
      return;
    }

    if (pathname === '/event-problems' && method === 'GET') {
      await json([]);
      return;
    }

    if (pathname === '/connector-mappings' && method === 'GET') {
      await json([]);
      return;
    }

    if (pathname === `/learning-recommendations/events/${eventRecord.id}` && method === 'GET') {
      await json({
        eventId: eventRecord.id,
        generatedAt: '2026-07-02T12:00:00.000Z',
        recommendations: [],
        dataCompletenessWarnings: [],
      });
      return;
    }

    if (pathname === `/planner/events/${eventRecord.id}/email-plans` && method === 'GET') {
      await json(emailPlans);
      return;
    }

    if (pathname === '/planner/email-plans' && method === 'POST') {
      await routeCollection(route, emailPlans, items => { emailPlans = items; }, 'email');
      return;
    }

    const emailUpdate = pathname.match(/^\/planner\/email-plans\/([^/]+)$/);
    if (emailUpdate && method === 'PUT') {
      const id = emailUpdate[1];
      const body = route.request().postDataJSON() as Record<string, unknown>;
      emailPlans = emailPlans.map(item => item.id === id ? { ...item, ...body, updatedAt: '2026-07-02T12:10:00.000Z' } : item);
      await json(emailPlans.find(item => item.id === id));
      return;
    }

    if (pathname === `/planner/events/${eventRecord.id}/whatsapp-plans` && method === 'GET') {
      await json(whatsappPlans);
      return;
    }

    if (pathname === '/planner/whatsapp-plans' && method === 'POST') {
      await routeCollection(route, whatsappPlans, items => { whatsappPlans = items; }, 'whatsapp');
      return;
    }

    const whatsappUpdate = pathname.match(/^\/planner\/whatsapp-plans\/([^/]+)$/);
    if (whatsappUpdate && method === 'PUT') {
      const id = whatsappUpdate[1];
      const body = route.request().postDataJSON() as Record<string, unknown>;
      whatsappPlans = whatsappPlans.map(item => item.id === id ? { ...item, ...body, updatedAt: '2026-07-02T12:10:00.000Z' } : item);
      await json(whatsappPlans.find(item => item.id === id));
      return;
    }

    if (pathname === `/planner/events/${eventRecord.id}/upsell-plans` && method === 'GET') {
      await json(upsellPlans);
      return;
    }

    if (pathname === '/planner/upsell-plans' && method === 'POST') {
      await routeCollection(route, upsellPlans, items => { upsellPlans = items; }, 'upsell');
      return;
    }

    const upsellUpdate = pathname.match(/^\/planner\/upsell-plans\/([^/]+)$/);
    if (upsellUpdate && method === 'PUT') {
      const id = upsellUpdate[1];
      const body = route.request().postDataJSON() as Record<string, unknown>;
      upsellPlans = upsellPlans.map(item => item.id === id ? { ...item, ...body, updatedAt: '2026-07-02T12:10:00.000Z' } : item);
      await json(upsellPlans.find(item => item.id === id));
      return;
    }

    if (pathname === `/planner/events/${eventRecord.id}/content-requirements` && method === 'GET') {
      await json(contentRequirements);
      return;
    }

    if (pathname === '/planner/content-requirements' && method === 'POST') {
      await routeCollection(route, contentRequirements, items => { contentRequirements = items; }, 'content');
      return;
    }

    const contentUpdate = pathname.match(/^\/planner\/content-requirements\/([^/]+)$/);
    if (contentUpdate && method === 'PUT') {
      const id = contentUpdate[1];
      const body = route.request().postDataJSON() as Record<string, unknown>;
      contentRequirements = contentRequirements.map(item => item.id === id ? { ...item, ...body, updatedAt: '2026-07-02T12:10:00.000Z' } : item);
      await json(contentRequirements.find(item => item.id === id));
      return;
    }

    if (pathname === `/planner/events/${eventRecord.id}/sales-tasks` && method === 'GET') {
      await json(salesTasks);
      return;
    }

    if (pathname === '/planner/sales-tasks' && method === 'POST') {
      await routeCollection(route, salesTasks, items => { salesTasks = items; }, 'task');
      return;
    }

    const salesTaskUpdate = pathname.match(/^\/planner\/sales-tasks\/([^/]+)$/);
    if (salesTaskUpdate && method === 'PUT') {
      const id = salesTaskUpdate[1];
      const body = route.request().postDataJSON() as Record<string, unknown>;
      salesTasks = salesTasks.map(item => item.id === id ? { ...item, ...body, updatedAt: '2026-07-02T12:10:00.000Z' } : item);
      await json(salesTasks.find(item => item.id === id));
      return;
    }

    await json({}, 404);
  });
}

test('Sprint 61 event planner creates and updates event-scoped campaign plans', async ({ page }) => {
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

  await installPlannerMocks(page);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));

  await page.goto(`/events/${eventRecord.id}`);

  await expect(page.getByRole('heading', { name: /^Events$/i })).toBeVisible();
  await expect(page.getByText(/Event Campaign Planner/i)).toBeVisible();
  await expect(page.getByText(/nothing is sent to customers/i)).toBeVisible();

  await page.getByLabel(/Sequence name/i).fill('Launch Awareness Sequence');
  await page.getByLabel(/Audience segment/i).first().fill('Warm followers');
  await page.getByLabel(/Email count/i).fill('4');
  await page.getByLabel(/Subject draft/i).fill('Seats are almost full');
  await page.getByLabel(/Email content/i).fill('Use proof, event date urgency, and a clear registration link.');
  await page.getByRole('button', { name: /Add Email Plan/i }).click();
  await expect(page.getByText(/Email plan added to this event/i)).toBeVisible();
  await expect(page.getByText('Launch Awareness Sequence', { exact: true })).toBeVisible();

  await page.getByLabel(/Audience segment/i).nth(1).fill('Booked but unpaid');
  await page.getByLabel(/Frequency/i).fill('Morning and evening reminder');
  await page.getByLabel(/Message draft/i).fill('Your event seat is reserved for a short time. Complete payment today.');
  await page.getByRole('button', { name: /Add WhatsApp Plan/i }).click();
  await expect(page.getByText(/WhatsApp plan added to this event/i)).toBeVisible();
  await expect(page.getByText('Booked but unpaid', { exact: true })).toBeVisible();

  await page.getByLabel(/Target segment/i).fill('Existing customers');
  await page.getByLabel(/^Offer$/i).fill('VIP upgrade with a bonus coaching call');
  await page.getByLabel(/FOMO angle/i).fill('Only 20 VIP seats remain before registration closes');
  await page.getByRole('button', { name: /Add Upsell Plan/i }).click();
  await expect(page.getByText(/Upsell plan added to this event/i)).toBeVisible();
  await expect(page.getByText('Existing customers', { exact: true })).toBeVisible();

  await page.getByLabel(/Asset type/i).selectOption('video');
  await page.getByLabel(/^Platform$/i).fill('Instagram Reels');
  await page.getByLabel(/^Requirement$/i).fill('Proof-led reel with testimonial, event date, and registration CTA.');
  await page.getByRole('button', { name: /Add Requirement/i }).click();
  await expect(page.getByText(/Content requirement added to this event/i)).toBeVisible();
  await expect(page.getByText(/Proof-led reel with testimonial/i).nth(1)).toBeVisible();
  await page.getByRole('button', { name: /Mark Ready/i }).click();
  await expect(page.getByText(/Content requirement marked Ready/i)).toBeVisible();

  await page.getByLabel(/Task type/i).selectOption('follow_up');
  await page.getByLabel(/Owner role/i).fill('sales_manager');
  await page.getByLabel(/Task description/i).fill('Call booked leads who did not complete payment.');
  await page.getByRole('button', { name: /Add Task/i }).click();
  await expect(page.getByText(/Sales task added to this event/i)).toBeVisible();
  await expect(page.getByText(/Call booked leads who did not complete payment/i).nth(1)).toBeVisible();
  await page.getByRole('button', { name: /Complete/i }).click();
  await expect(page.getByText(/Sales task marked Completed/i)).toBeVisible();

  await expect(page.getByRole('button', { name: /^Approve$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Reject$/i })).toHaveCount(0);

  const bodyText = await page.locator('body').innerText();
  expect(bodyText).not.toContain(eventRecord.id);
  expect(bodyText).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  expect(bodyText).not.toContain('{');
  expect(bodyText).not.toContain('tenantKey');
  expect(bodyText).not.toMatch(/sent successfully|message delivered|email delivered/i);
  expect(consoleErrors).toEqual([]);
  expect(failedResponses).toEqual([]);
});
