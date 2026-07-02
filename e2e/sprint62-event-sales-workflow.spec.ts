import { expect, test, type Page } from '@playwright/test';

const eventId = '11111111-1111-4111-8111-111111111111';

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
  id: eventId,
  name: 'Tagyeer wa Irtaqi - Sales Workflow',
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

type LeadRecord = {
  id: string;
  tenantKey: string;
  eventId: string;
  leadStatus: string;
  leadTemperature: string;
  audienceSource: string;
  channelAttribution: string;
  platform: string;
  leadName: string;
  leadEmail: string;
  leadPhone: string;
  salesNotes: string | null;
  nextAction: string | null;
  followUpDate: string | null;
  meetingDate: string | null;
  meetingType: string | null;
  meetingOutcome: string | null;
  purchaseDate: string | null;
  purchaseAmount: number | null;
  purchaseReference: string | null;
  createdAt: string;
  updatedAt: string;
};

function dashboardBody(leads: LeadRecord[]) {
  const purchases = leads.filter(lead => lead.leadStatus === 'purchased').length;
  const meetings = leads.filter(lead => lead.leadStatus === 'meeting_booked').length;
  const attended = leads.filter(lead => lead.leadStatus === 'meeting_attended').length;
  const noShows = leads.filter(lead => lead.leadStatus === 'no_show').length;

  return {
    event: eventRecord,
    kpis: {
      newLeads: leads.length,
      capturedLeads: leads.length,
      reportedLeads: 0,
      formCompletions: 0,
      meetingsBooked: meetings,
      meetingsAttended: attended,
      purchases,
      noShows,
      noShowRate: 0,
      plannedBudget: eventRecord.plannedBudget,
      actualSpend: 0,
      budgetVariance: eventRecord.plannedBudget,
      reach: 0,
      impressions: 0,
      interactions: 0,
      clicks: 0,
      interactionRate: 0,
      costPerLead: 0,
      costPerPurchase: 0,
    },
    funnel: [
      { label: 'Reach', value: 0 },
      { label: 'Interactions', value: 0 },
      { label: 'Forms', value: 0 },
      { label: 'Leads', value: leads.length },
      { label: 'Meetings', value: meetings },
      { label: 'Purchases', value: purchases },
    ],
    channelPerformance: [],
    leadTemperature: [
      { label: 'Cold', value: leads.filter(lead => lead.leadTemperature === 'cold').length },
      { label: 'Warm', value: leads.filter(lead => lead.leadTemperature === 'warm').length },
      { label: 'Hot', value: leads.filter(lead => lead.leadTemperature === 'hot').length },
      { label: 'Buyer', value: purchases },
      { label: 'No-show', value: noShows },
    ],
    nextActions: leads.length ? [
      {
        title: 'Operate captured leads',
        detail: 'Move prospects through contact, meeting, purchase, or recovery states.',
        priority: 'medium',
      },
    ] : [
      {
        title: 'Capture event leads',
        detail: 'Add leads from forms, DMs, WhatsApp, or manual sales notes.',
        priority: 'high',
      },
    ],
    kpiRecords: [],
    campaigns: [],
    leads,
    sourceStatus: {
      manualRecords: 0,
      importedRecords: 0,
      connectorRecords: 0,
    },
  };
}

async function installSprint62Mocks(page: Page) {
  const leads: LeadRecord[] = [];

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

    if (pathname === `/events/${eventId}/dashboard`) {
      await json(dashboardBody(leads));
      return;
    }

    if (pathname === '/leads' && method === 'GET') {
      await json(leads.filter(lead => !url.searchParams.get('eventId') || lead.eventId === url.searchParams.get('eventId')));
      return;
    }

    if (pathname === '/leads' && method === 'POST') {
      const body = route.request().postDataJSON() as Partial<LeadRecord>;
      const now = '2026-07-02T12:00:00.000Z';
      const lead: LeadRecord = {
        id: `lead-${leads.length + 1}`,
        tenantKey: 'default',
        eventId: String(body.eventId || eventId),
        leadStatus: 'new_lead',
        leadTemperature: 'cold',
        audienceSource: String(body.audienceSource || 'follower'),
        channelAttribution: String(body.channelAttribution || 'instagram'),
        platform: String(body.platform || 'instagram'),
        leadName: String(body.leadName || 'Unnamed lead'),
        leadEmail: String(body.leadEmail || ''),
        leadPhone: String(body.leadPhone || ''),
        salesNotes: body.salesNotes ? String(body.salesNotes) : null,
        nextAction: null,
        followUpDate: null,
        meetingDate: null,
        meetingType: null,
        meetingOutcome: null,
        purchaseDate: null,
        purchaseAmount: null,
        purchaseReference: null,
        createdAt: now,
        updatedAt: now,
      };
      leads.push(lead);
      await json(lead, 201);
      return;
    }

    const leadMatch = pathname.match(/^\/leads\/([^/]+)(?:\/([^/]+))?$/);
    if (leadMatch) {
      const lead = leads.find(item => item.id === leadMatch[1]);
      if (!lead) {
        await json({ error: 'Lead not found' }, 404);
        return;
      }

      const action = leadMatch[2];
      const body = route.request().postDataJSON?.() as Record<string, unknown> | undefined;

      if (!action && method === 'PUT') {
        lead.nextAction = body?.nextAction ? String(body.nextAction) : null;
        lead.followUpDate = body?.followUpDate ? String(body.followUpDate) : null;
        lead.salesNotes = body?.salesNotes ? String(body.salesNotes) : null;
        await json(lead);
        return;
      }

      if (action === 'temperature') {
        lead.leadTemperature = String(body?.temperature || 'warm');
        await json(lead);
        return;
      }

      if (action === 'transition') {
        lead.leadStatus = String(body?.toStatus || lead.leadStatus);
        await json(lead);
        return;
      }

      if (action === 'meeting') {
        lead.leadStatus = 'meeting_booked';
        lead.meetingDate = String(body?.meetingDate || '2026-07-03T12:00:00.000Z');
        lead.meetingType = String(body?.meetingType || 'strategy_call');
        lead.meetingOutcome = body?.meetingOutcome ? String(body.meetingOutcome) : null;
        await json(lead);
        return;
      }

      if (action === 'purchase') {
        lead.leadStatus = 'purchased';
        lead.purchaseDate = String(body?.purchaseDate || '2026-07-04T12:00:00.000Z');
        lead.purchaseAmount = Number(body?.purchaseAmount || 0);
        lead.purchaseReference = body?.purchaseReference ? String(body.purchaseReference) : null;
        lead.leadTemperature = 'buyer';
        await json(lead);
        return;
      }
    }

    await json({});
  });
}

test('Sprint 62 event sales workflow captures and converts a lead', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await installSprint62Mocks(page);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));

  await page.goto(`/events/${eventId}`);
  await expect(page.getByRole('heading', { name: /^Events$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Sales Workflow', exact: true })).toBeVisible();
  await expect(page.getByText('Capture event leads', { exact: true })).toBeVisible();

  await page.getByLabel(/Lead name/i).fill('Ahmed Al-Rashid');
  await page.getByLabel(/^Email$/i).fill('ahmed@example.com');
  await page.getByLabel(/Phone/i).fill('+966500000000');
  await page.getByLabel(/Sales note/i).fill('Asked about VIP access and event seats.');
  await page.getByRole('button', { name: /Capture Lead/i }).click();

  await expect(page.getByText(/Lead captured and linked to this event/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Ahmed Al-Rashid/i })).toBeVisible();

  await page.getByLabel(/Lead temperature/i).selectOption('hot');
  await page.getByLabel(/Next action/i).fill('Book VIP strategy call');
  await page.getByLabel(/Sales notes/i).fill('Strong intent, wants seat availability.');
  await page.getByRole('button', { name: /Save Follow-up/i }).click();
  await expect(page.getByText(/Lead follow-up details updated/i)).toBeVisible();

  await page.getByRole('button', { name: /Mark Contacted/i }).click();
  await expect(page.getByText(/Lead moved to Contacted/i)).toBeVisible();

  await page.getByRole('button', { name: /Book Meeting/i }).click();
  await expect(page.getByText(/Meeting booked for selected lead/i)).toBeVisible();

  await page.getByRole('button', { name: /Mark Attended/i }).click();
  await expect(page.getByText(/Lead moved to Meeting Attended/i)).toBeVisible();

  await page.getByLabel(/Amount/i).fill('2400');
  await page.getByLabel(/Reference/i).fill('manual-sale-001');
  await page.getByRole('button', { name: /Record Purchase/i }).click();
  await expect(page.getByText(/Purchase recorded for selected lead/i)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Purchased' })).toBeVisible();
  await expect(page.getByText(/1 event lead/i)).toBeVisible();

  const body = await page.locator('body').innerText();
  expect(body).not.toContain(eventId);
  expect(consoleErrors).toEqual([]);
});
