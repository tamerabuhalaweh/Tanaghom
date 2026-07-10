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

type EventRecord = {
  id: string;
  name: string;
  eventType: string;
  eventDate: string;
  location: string;
  campaignStartDate: string;
  campaignEndDate: string | null;
  expectedAttendance: number;
  revenueTarget: number;
  plannedBudget: number;
  ownerUserName: string;
  status: string;
  offer: string;
  audience: string;
  geography: string;
  fomoAngle: string;
  selectedChannels: string[];
};

type KpiRecord = {
  id: string;
  metricDate: string;
  channel: string;
  reach: number;
  impressions: number;
  interactions: number;
  clicks: number;
  formCompletions: number;
  leads: number;
  meetingsBooked: number;
  meetingsAttended: number;
  purchases: number;
  noShows: number;
  spend: number;
  sourceType: string;
};

const eventRecord: EventRecord = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Tagyeer wa Irtaqi - E2E Event',
  eventType: 'tagyeer_wa_irtaqi',
  eventDate: '2026-08-01T12:00:00.000Z',
  location: 'Dubai',
  campaignStartDate: '2026-07-02T12:00:00.000Z',
  campaignEndDate: null,
  expectedAttendance: 200,
  revenueTarget: 120000,
  plannedBudget: 35000,
  ownerUserName: 'Admin User',
  status: 'draft',
  offer: 'Two-day live transformation course.',
  audience: 'Warm followers and existing customers.',
  geography: 'GCC and Jordan',
  fomoAngle: 'Limited seats and date-based urgency.',
  selectedChannels: ['instagram', 'meta_ads', 'email', 'whatsapp'],
};

function dashboardBody(events: EventRecord[], records: KpiRecord[]) {
  const event = events[0];
  const totals = records.reduce(
    (sum, record) => ({
      reach: sum.reach + record.reach,
      impressions: sum.impressions + record.impressions,
      interactions: sum.interactions + record.interactions,
      clicks: sum.clicks + record.clicks,
      formCompletions: sum.formCompletions + record.formCompletions,
      leads: sum.leads + record.leads,
      meetingsBooked: sum.meetingsBooked + record.meetingsBooked,
      meetingsAttended: sum.meetingsAttended + record.meetingsAttended,
      purchases: sum.purchases + record.purchases,
      noShows: sum.noShows + record.noShows,
      spend: sum.spend + record.spend,
    }),
    {
      reach: 0,
      impressions: 0,
      interactions: 0,
      clicks: 0,
      formCompletions: 0,
      leads: 0,
      meetingsBooked: 0,
      meetingsAttended: 0,
      purchases: 0,
      noShows: 0,
      spend: 0,
    },
  );

  return {
    event,
    kpis: {
      newLeads: totals.leads,
      capturedLeads: 0,
      reportedLeads: totals.leads,
      formCompletions: totals.formCompletions,
      meetingsBooked: totals.meetingsBooked,
      meetingsAttended: totals.meetingsAttended,
      purchases: totals.purchases,
      noShows: totals.noShows,
      noShowRate: totals.meetingsBooked ? Number(((totals.noShows / totals.meetingsBooked) * 100).toFixed(1)) : 0,
      plannedBudget: event.plannedBudget,
      actualSpend: totals.spend,
      budgetVariance: event.plannedBudget - totals.spend,
      reach: totals.reach,
      impressions: totals.impressions,
      interactions: totals.interactions,
      clicks: totals.clicks,
      interactionRate: totals.impressions ? Number(((totals.interactions / totals.impressions) * 100).toFixed(1)) : 0,
      costPerLead: totals.leads ? Number((totals.spend / totals.leads).toFixed(2)) : 0,
      costPerPurchase: totals.purchases ? Number((totals.spend / totals.purchases).toFixed(2)) : 0,
    },
    funnel: [
      { label: 'Reach', value: totals.reach },
      { label: 'Interactions', value: totals.interactions },
      { label: 'Forms', value: totals.formCompletions },
      { label: 'Leads', value: totals.leads },
      { label: 'Meetings', value: totals.meetingsBooked },
      { label: 'Purchases', value: totals.purchases },
    ],
    channelPerformance: records.map(record => ({
      channel: record.channel,
      reach: record.reach,
      interactions: record.interactions,
      leads: record.leads,
      purchases: record.purchases,
      spend: record.spend,
      conversionRate: record.leads ? Number(((record.purchases / record.leads) * 100).toFixed(1)) : 0,
    })),
    leadTemperature: [
      { label: 'Cold', value: 0 },
      { label: 'Warm', value: 0 },
      { label: 'Hot', value: 0 },
      { label: 'Buyer', value: totals.purchases },
      { label: 'No-show', value: totals.noShows },
    ],
    nextActions: records.length ? [] : [
      {
        title: 'Add the first event KPI update',
        detail: 'Enter today&apos;s event data.',
        priority: 'high',
      },
    ],
    kpiRecords: records,
    campaigns: [],
    leads: [],
    sourceStatus: {
      manualRecords: records.filter(record => record.sourceType === 'manual').length,
      importedRecords: records.filter(record => record.sourceType === 'imported').length,
      connectorRecords: records.filter(record => record.sourceType === 'connector').length,
    },
  };
}

async function installEventApiMocks(page: Page) {
  const events: EventRecord[] = [];
  const records: KpiRecord[] = [];
  const mappings: Array<{
    id: string;
    eventId: string;
    connectorId: string;
    displayName: string;
    targetType: string;
    validationStatus: string;
    fieldMappings: Array<{ sourceField: string; targetField: string }>;
  }> = [];
  let lastDryRunRows: KpiRecord[] = [];

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
      await json(events);
      return;
    }

    if (pathname === '/events' && method === 'POST') {
      const body = route.request().postDataJSON() as Partial<EventRecord>;
      const created = {
        ...eventRecord,
        ...body,
        id: eventRecord.id,
        ownerUserName: 'Admin User',
        status: 'draft',
        eventDate: body.eventDate || eventRecord.eventDate,
        campaignStartDate: body.campaignStartDate || eventRecord.campaignStartDate,
        campaignEndDate: body.campaignEndDate || null,
        expectedAttendance: Number(body.expectedAttendance || eventRecord.expectedAttendance),
        revenueTarget: Number(body.revenueTarget || eventRecord.revenueTarget),
        plannedBudget: Number(body.plannedBudget || eventRecord.plannedBudget),
      } as EventRecord;
      events.splice(0, events.length, created);
      await json(created, 201);
      return;
    }

    if (pathname === `/events/${eventRecord.id}/dashboard`) {
      await json(dashboardBody(events.length ? events : [eventRecord], records));
      return;
    }

    if (pathname === `/events/${eventRecord.id}/kpis` && method === 'POST') {
      const body = route.request().postDataJSON() as Partial<KpiRecord>;
      const record = {
        id: `kpi-${records.length + 1}`,
        metricDate: String(body.metricDate || '2026-07-02T12:00:00.000Z'),
        channel: String(body.channel || 'instagram'),
        reach: Number(body.reach || 0),
        impressions: Number(body.impressions || 0),
        interactions: Number(body.interactions || 0),
        clicks: Number(body.clicks || 0),
        formCompletions: Number(body.formCompletions || 0),
        leads: Number(body.leads || 0),
        meetingsBooked: Number(body.meetingsBooked || 0),
        meetingsAttended: Number(body.meetingsAttended || 0),
        purchases: Number(body.purchases || 0),
        noShows: Number(body.noShows || 0),
        spend: Number(body.spend || 0),
        sourceType: 'manual',
      };
      records.push(record);
      await json(record, 201);
      return;
    }

    if (pathname === `/events/${eventRecord.id}/campaigns` || pathname === `/events/${eventRecord.id}/leads`) {
      await json([]);
      return;
    }

    if (pathname === '/connector-mappings' && method === 'GET') {
      await json(mappings);
      return;
    }

    if (pathname === '/connector-mappings' && method === 'POST') {
      const body = route.request().postDataJSON() as {
        eventId: string;
        connectorId: string;
        displayName: string;
        targetType: string;
        fieldMappings: Array<{ sourceField: string; targetField: string }>;
      };
      const mapping = {
        id: 'mapping-11111111-1111-4111-8111-111111111111',
        eventId: body.eventId,
        connectorId: body.connectorId,
        displayName: body.displayName,
        targetType: body.targetType,
        validationStatus: 'valid',
        fieldMappings: body.fieldMappings,
      };
      mappings.splice(0, mappings.length, mapping);
      await json(mapping, 201);
      return;
    }

    if (pathname === '/csv-import/dry-run' && method === 'POST') {
      const body = route.request().postDataJSON() as {
        eventId: string;
        mappingId: string;
        rows: Array<Record<string, string>>;
      };
      lastDryRunRows = body.rows.map((row, index) => ({
        id: `dry-run-${index + 1}`,
        metricDate: `${row.date || row.metricDate}T12:00:00.000Z`,
        channel: row.channel || 'manual',
        reach: Number(row.reach || 0),
        impressions: Number(row.impressions || 0),
        interactions: Number(row.interactions || 0),
        clicks: Number(row.clicks || 0),
        formCompletions: Number(row.formCompletions || row.forms || 0),
        leads: Number(row.leads || 0),
        meetingsBooked: Number(row.meetingsBooked || row.meetings || 0),
        meetingsAttended: Number(row.meetingsAttended || 0),
        purchases: Number(row.purchases || 0),
        noShows: Number(row.noShows || 0),
        spend: Number(row.spend || 0),
        sourceType: 'connector',
      }));
      await json({
        mappingId: body.mappingId,
        eventId: body.eventId,
        mappingUpdatedAt: '2026-07-02T12:00:00.000Z',
        totalRows: body.rows.length,
        validRows: lastDryRunRows.length,
        invalidRows: 0,
        kpiRows: lastDryRunRows,
        validationErrors: [],
        warnings: [],
      });
      return;
    }

    if (pathname === '/csv-import/approve-import' && method === 'POST') {
      records.push(...lastDryRunRows);
      await json({
        mappingId: 'mapping-11111111-1111-4111-8111-111111111111',
        eventId: eventRecord.id,
        imported: { kpiRecords: lastDryRunRows.length },
        auditRecordId: 'audit-1',
      });
      return;
    }

    if (pathname === `/learning-recommendations/events/${eventRecord.id}` && method === 'GET') {
      await json({
        eventId: eventRecord.id,
        eventName: eventRecord.name,
        generatedAt: '2026-07-02T12:00:00.000Z',
        recommendations: [
          {
            id: 'rec-1',
            category: 'no_show',
            priority: 'high',
            title: 'High no-show rate detected',
            recommendation: 'Send meeting reminders and follow up quickly with missed appointments.',
            rationale: 'No-shows reduce conversion and waste sales capacity.',
            evidenceSummary: '3 no-shows from 16 booked meetings.',
            sourceMetrics: { meetingsBooked: 16, noShows: 3 },
            sourceSections: ['leadFunnel', 'salesOutcomes'],
            confidence: 'medium',
            missingDataWarnings: ['Low sample size - no-show rate may change after more meetings'],
            suggestedOwnerRole: 'sales_manager',
            nextAction: 'Prepare a no-show recovery workflow before the next event.',
          },
        ],
        dataCompletenessWarnings: ['No campaign records available - channel performance analysis limited'],
      });
      return;
    }

    await json({});
  });
}

test('Sprint 60 event strategy and KPI dashboard workflow is wired', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await installEventApiMocks(page);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));

  await page.goto('/events/advanced');
  await expect(page.getByRole('heading', { name: /^Events$/i })).toBeVisible();
  await expect(page.getByText(/No events yet/i)).toBeVisible();

  await page.getByRole('button', { name: /Create Event Strategy/i }).click();
  await expect(page.getByRole('heading', { name: /Create Event Strategy/i })).toBeVisible();
  await page.getByLabel(/Event Name/i).fill('Tagyeer wa Irtaqi - E2E Event');
  await page.getByLabel(/Location/i).fill('Dubai');
  await page.getByLabel(/Planned Budget/i).fill('35000');
  await page.getByLabel(/Revenue Target/i).fill('120000');
  await page.getByRole('button', { name: /Create Event Workspace/i }).click();

  await expect(page).toHaveURL(/\/events\/11111111-1111-4111-8111-111111111111$/);
  await page.goto('/events/advanced/11111111-1111-4111-8111-111111111111');
  await expect(page.getByRole('heading', { name: /Tagyeer wa Irtaqi - E2E Event/i })).toBeVisible();
  await expect(page.getByText(/Fallback KPI Correction/i)).toBeVisible();

  await page.getByLabel(/Reach/i).fill('5000');
  await page.getByLabel(/Interactions/i).fill('640');
  await page.getByLabel(/^Forms$/i).fill('80');
  await page.getByLabel(/^Leads$/i).fill('42');
  await page.getByLabel(/^Meetings$/i).fill('16');
  await page.getByLabel(/^Purchases$/i).fill('7');
  await page.getByLabel(/Spend/i).fill('2800');
  await page.getByRole('button', { name: /Save Fallback Correction/i }).click();

  await expect(page.getByText(/Event KPI update saved/i)).toBeVisible();
  await expect(page.getByText(/80 forms completed/i)).toBeVisible();
  await expect(page.getByText(/\$2,800 actual spend/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Channel Performance$/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^KPI Evidence$/i })).toBeVisible();
  await expect(page.getByText(/What To Improve Next/i)).toBeVisible();
  await expect(page.locator('main')).toContainText('High no-show rate detected');
  await expect(page.locator('main')).toContainText('Prepare a no-show recovery workflow before the next event.');

  await expect(page.getByText(/Import KPI CSV/i)).toBeVisible();
  await page.getByLabel(/CSV rows/i).fill('date,channel,leads,purchases,spend\n2026-07-03,formaloo,11,2,350');
  await page.getByRole('button', { name: /Detect Headers/i }).click();
  await expect(page.getByText(/Headers detected/i)).toBeVisible();
  await page.getByRole('button', { name: /Save Mapping/i }).click();
  await expect(page.getByText(/Connector mapping saved/i)).toBeVisible();
  await page.getByRole('button', { name: /Run Dry-Run/i }).click();
  await expect(page.getByText(/Dry-run complete: 1 valid row/i)).toBeVisible();
  await page.getByRole('button', { name: /Approve Import/i }).click();
  await expect(page.getByText(/Import approved: 1 KPI record/i)).toBeVisible();
  await expect(page.getByText(/Approved Import Bridge/i)).toBeVisible();
  await expect(page.getByText(/1 connector/i)).toBeVisible();
  expect(consoleErrors).toEqual([]);
});
