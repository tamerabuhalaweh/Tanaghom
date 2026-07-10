import { expect, test, type Page } from '@playwright/test';

type Role = 'department_head' | 'viewer';

const people = {
  department_head: { id: 'manager-1', email: 'commercial.manager@tanaghum.com', name: 'Commercial Manager', role: 'department_head', tenantKey: 'default' },
  viewer: { id: 'viewer-1', email: 'growth.viewer@tanaghum.com', name: 'Growth Viewer', role: 'viewer', tenantKey: 'default' },
};

const event = {
  id: 'event-leadership',
  name: 'Leadership Course Launch',
  eventType: 'virtual_event',
  eventDate: '2026-09-18T12:00:00.000Z',
  location: 'Online',
  status: 'active',
  offer: 'Leadership course for entrepreneurs',
  audience: 'Warm followers and previous buyers',
  geography: 'Middle East',
  plannedBudget: 5000,
  revenueTarget: 30000,
  selectedChannels: ['instagram', 'email', 'whatsapp'],
};

const leads = [
  { id: 'lead-nadia', eventId: event.id, leadName: 'Nadia Hassan', leadEmail: 'nadia@customer.test', leadPhone: '+971500000001', sourcePlatform: 'instagram', leadStatus: 'meeting_booked', leadTemperature: 'hot', consentStatus: 'granted', nextAction: 'Confirm the strategy call', followUpDate: '2026-07-11T15:00:00.000Z', ownerRole: 'sales_manager' },
  { id: 'lead-omar', eventId: event.id, leadName: 'Omar Khalil', leadEmail: 'omar@customer.test', sourcePlatform: 'referral', leadStatus: 'qualified', leadTemperature: 'warm', consentStatus: 'granted', nextAction: 'Send the course outline', ownerRole: 'sales_manager' },
  { id: 'lead-rana', eventId: event.id, leadName: 'Rana Saleh', leadEmail: 'rana@customer.test', sourcePlatform: 'landing_page', leadStatus: 'new_lead', leadTemperature: 'warm', consentStatus: 'pending', ownerRole: 'lead_qualification_manager' },
];

function eventDashboard() {
  return {
    event,
    kpis: { plannedBudget: 5000, actualSpend: 2100, budgetVariance: 2900, newLeads: 184, capturedLeads: 3, meetingsBooked: 31, meetingsAttended: 26, noShows: 2, noShowRate: 6.5, purchases: 12 },
    sourceStatus: { primarySource: 'connector', connectorRecords: 8, importedRecords: 0 },
    funnel: [{ label: 'Leads', value: 184 }, { label: 'Meetings', value: 31 }, { label: 'Purchases', value: 12 }],
    channelPerformance: [{ channel: 'instagram', leads: 90, purchases: 8, spend: 1200 }],
    leadTemperature: [{ label: 'Hot', value: 1 }, { label: 'Warm', value: 2 }],
    nextActions: [
      { title: 'Approve the paid advertising brief', detail: 'Confirm audience, offer, and campaign budget.', priority: 'high' },
      { title: 'Follow up with five hot leads', detail: 'Assign the same-day sales owner.', priority: 'medium' },
    ],
    kpiRecords: [{ id: 'kpi-1', metricDate: '2026-07-10', channel: 'instagram', sourceType: 'connector', leads: 90, purchases: 8, spend: 1200 }],
  };
}

function growthSummary() {
  return {
    kpis: { activeCampaigns: 2, postsPrepared: 8, courseCtaClicks: 42 },
    integrations: { goHighLevel: 'configured', smartLabsVoice: 'requires_credentials' },
    funnel: [{ label: 'Campaigns', value: 2 }, { label: 'Content', value: 8 }, { label: 'Leads', value: 3 }, { label: 'Qualified', value: 1 }],
  };
}

async function installMocks(page: Page, role: Role) {
  let currentLeads = structuredClone(leads);
  const unexpected: string[] = [];
  const failed: string[] = [];
  const browserProblems: string[] = [];

  await page.addInitScript(() => window.localStorage.setItem('token', 'ux-r1d2-production-token'));
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', error => browserProblems.push(`pageerror: ${error.message}`));
  page.on('response', response => { if (response.url().includes(':4000') && response.status() >= 400) failed.push(`${response.status()} ${response.url()}`); });

  await page.route('**/*', async route => {
    const request = route.request();
    if (request.resourceType() === 'document') return route.continue();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const knownPrefix = ['/auth/', '/events', '/leads', '/event-problems', '/planner/', '/ghl-sync/', '/closeout/', '/learning-recommendations/', '/analytics/', '/social-growth/', '/ghl/', '/smartlabs/'];
    if (!knownPrefix.some(prefix => path === prefix || path.startsWith(prefix))) return route.continue();

    if (path === '/auth/session') return json({ user: people[role], agentRep: { id: `profile-${role}`, name: people[role].name, status: 'active' } });
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/events') return json([event]);
    if (path === `/events/${event.id}/dashboard`) return json(eventDashboard());
    if (path === '/leads' && method === 'GET') return json(currentLeads);
    if (path === '/leads/stats') return json({ total: currentLeads.length, qualified: currentLeads.filter(lead => lead.leadStatus === 'qualified').length, nurturing: 0 });
    if (path === '/leads' && method === 'POST') {
      const created = { id: 'lead-created', ...(request.postDataJSON() as object), leadStatus: 'new_lead', leadTemperature: 'cold' };
      currentLeads = [...currentLeads, created as typeof leads[number]];
      return json(created, 201);
    }
    if (/^\/leads\/[^/]+\/qualify$/.test(path) && method === 'POST') {
      const id = path.split('/')[2];
      currentLeads = currentLeads.map(lead => lead.id === id ? { ...lead, leadStatus: 'qualified' } : lead);
      return json(currentLeads.find(lead => lead.id === id));
    }
    if (path === `/event-problems/dashboard/${event.id}`) return json({ openProblems: 2, criticalOpen: 0, topBlockers: [{ id: 'problem-1', title: 'Creative assets are due soon', description: 'Assign the remaining video edit.', severity: 'high', status: 'open' }] });
    if (path === '/event-problems') return json([{ id: 'problem-1', eventId: event.id, title: 'Creative assets are due soon', description: 'Assign the remaining video edit.', category: 'content', severity: 'high', status: 'open' }]);
    if (path === `/planner/events/${event.id}/email-plans`) return json([{ id: 'email-1', sequenceName: 'Warm audience launch', audienceSegment: 'Previous buyers', emailCount: 3, approvalStatus: 'approved' }]);
    if (path === `/planner/events/${event.id}/whatsapp-plans`) return json([{ id: 'wa-1', audienceSegment: 'Booked customers', frequency: 'weekly', contentType: 'text', approvalStatus: 'pending_review' }]);
    if (path === `/planner/events/${event.id}/upsell-plans`) return json([{ id: 'up-1', targetSegment: 'Previous buyers', offer: 'Leadership course', plannedChannel: 'email', approvalStatus: 'draft' }]);
    if (path === `/planner/events/${event.id}/content-requirements`) return json([{ id: 'content-1', assetType: 'video', description: 'Event announcement', platform: 'instagram', status: 'in_progress' }]);
    if (path === `/planner/events/${event.id}/sales-tasks`) return json([{ id: 'task-1', taskType: 'follow_up', description: 'Call hot leads', ownerRole: 'sales_manager', status: 'pending' }]);
    if (path === '/ghl-sync/status') return json({ credentialStatus: 'configured', mappingStatus: 'ready', acceptance: { status: 'ready_for_read_sync', readyForReadSync: true } });
    if (path === `/closeout/events/${event.id}/report`) return json({ eventSummary: event, budget: { planned: 5000, actual: 2100 }, leadFunnel: { totalLeads: 3, meetingsBooked: 1, purchases: 0 }, channelPerformance: [], sourcePerformance: [], topBarriers: [] });
    if (path === `/learning-recommendations/events/${event.id}`) return json({ recommendations: [{ id: 'rec-1', title: 'Keep same-day follow-up', rationale: 'Hot leads converted faster when assigned on the same day.', priority: 'high' }] });
    if (path === '/analytics/sources') return json([{ id: 'source-1', name: 'Instagram Analytics', status: 'active', sourceType: 'connector' }]);
    if (path === '/analytics/snapshots') return json([{ id: 'snapshot-1', normalizedMetrics: { reach: 12400, impressions: 20800, engagement: 920 } }]);
    if (path === '/analytics/reports') return json([{ id: 'report-1', summary: 'Weekly campaign report', reportStatus: 'generated' }]);
    if (path === '/social-growth/summary') return json(growthSummary());
    if (path === '/ghl/sandbox-contact' && method === 'POST') return json({ status: 'prepared', credentialSource: 'tenant', endpoint: '/contacts', safety: { executionPerformed: false } });
    if (path === `/smartlabs/leads/${leads[0].id}/handoff-preview` && method === 'POST') return json({ status: 'prepared', safety: { externalCallPerformed: false, rawSecretsReturned: false } });

    unexpected.push(`${method} ${path}${url.search}`);
    return json({ error: `Unexpected UX-R1D2 request: ${method} ${path}` }, 500);
  });

  return {
    assertClean() {
      expect(unexpected, 'UX-R1D2 must not call unrelated APIs').toEqual([]);
      expect(failed, 'UX-R1D2 must not receive failed API responses').toEqual([]);
      expect(browserProblems, 'UX-R1D2 must not emit console errors or warnings').toEqual([]);
    },
  };
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectControlsAreUsable(page: Page) {
  const undersized = await page.locator('button:visible, input:visible, select:visible').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { name: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, width: box.width, height: box.height };
  }).filter(control => control.width < 44 || control.height < 44));
  expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
}

async function capture(page: Page, name: string, fullPage = true) {
  if (process.env.UX_CAPTURE !== '1') return;
  await page.screenshot({ path: `docs/ux/ux-r1d2/${name}.png`, fullPage });
}

test.describe('UX-R1D2 production workspaces', () => {
  test('manager operates the event workspace without repeated orientation or hidden failures', async ({ page }) => {
    const monitor = await installMocks(page, 'department_head');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/events/${event.id}`);

    await expect(page).toHaveTitle('Event Operations | Tanaghum');
    await expect(page.getByRole('heading', { name: 'Event Operations' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Selected event' })).toHaveValue(event.id);
    await expect(page.getByRole('heading', { name: 'What needs attention today' })).toBeVisible();
    await expect(page.getByText('Run the event workflow')).toHaveCount(0);
    await expect(page.getByText('Today Focus')).toHaveCount(0);
    await expect(page.getByText(/Sprint \d+|Acceptance Event|MCP|M5|SAIF/i)).toHaveCount(0);
    await expectNoOverflow(page);
    await expectControlsAreUsable(page);
    await capture(page, 'production-events-desktop');

    const tabs = page.getByRole('navigation', { name: 'Event workspace views' });
    await tabs.getByRole('button', { name: 'Plan' }).click();
    await expect(page.getByRole('heading', { name: 'Event Strategy' })).toBeVisible();
    await tabs.getByRole('button', { name: 'KPIs' }).click();
    await expect(page.getByRole('cell', { name: 'Instagram' })).toBeVisible();
    await tabs.getByRole('button', { name: 'Leads' }).click();
    await expect(page.getByText('Nadia Hassan')).toBeVisible();
    await tabs.getByRole('button', { name: 'Risks' }).click();
    await expect(page.getByText('Creative assets are due soon')).toBeVisible();
    await expectNoOverflow(page);
    monitor.assertClean();
  });

  test('manager completes the Sales & Leads list/detail and governed preview flow', async ({ page }) => {
    const monitor = await installMocks(page, 'department_head');
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto('/performance');

    await expect(page).toHaveTitle('Sales & Leads | Tanaghum');
    await expect(page.getByRole('heading', { name: 'Sales & Leads' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Lead pipeline' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Performance' })).toHaveCount(0);
    await expectControlsAreUsable(page);
    await capture(page, 'production-sales-desktop');
    await page.getByRole('button', { name: /Nadia Hassan/ }).click();
    await expect(page.getByRole('heading', { name: 'Nadia Hassan' })).toBeVisible();
    await page.getByRole('button', { name: 'Prepare CRM handoff' }).click();
    await expect(page.getByText('CRM handoff preview prepared. No external data was sent.')).toBeVisible();
    await page.getByRole('button', { name: 'Voice/chat handoff' }).click();
    await expect(page.getByText('Voice/chat handoff preview prepared. No external call was made.')).toBeVisible();
    await expectNoOverflow(page);

    const views = page.getByRole('navigation', { name: 'Sales and lead views' });
    await views.getByRole('button', { name: 'Performance' }).click();
    await expect(page.getByRole('heading', { name: 'Content performance' })).toBeVisible();
    await views.getByRole('button', { name: 'Data Readiness' }).click();
    await expect(page.getByRole('heading', { name: 'Data readiness' })).toBeVisible();
    monitor.assertClean();
  });

  test('mobile Sales & Leads uses list to detail and viewer sees no mutation controls', async ({ page }) => {
    const monitor = await installMocks(page, 'viewer');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/performance');

    await expect(page.getByRole('heading', { name: 'Lead pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Lead' })).toHaveCount(0);
    await expectControlsAreUsable(page);
    await capture(page, 'production-sales-mobile-list', false);
    await page.getByRole('button', { name: /Nadia Hassan/ }).click();
    await expect(page.getByRole('button', { name: 'Back to leads' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Mark Qualified/ })).toHaveCount(0);
    await capture(page, 'production-sales-mobile-detail', false);
    await expectNoOverflow(page);
    await page.getByRole('button', { name: 'Back to leads' }).click();
    await expect(page.getByRole('heading', { name: 'Lead pipeline' })).toBeVisible();

    await page.setViewportSize({ width: 768, height: 900 });
    await expectNoOverflow(page);
    await page.setViewportSize({ width: 1024, height: 900 });
    await expect(page.getByRole('navigation', { name: 'Product navigation' })).toBeVisible();
    await expectNoOverflow(page);
    monitor.assertClean();
  });

  test('viewer opens Event Operations without unauthorized problem-dashboard calls', async ({ page }) => {
    const monitor = await installMocks(page, 'viewer');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/events/${event.id}`);
    await expect(page.getByRole('heading', { name: 'Event Operations' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What needs attention today' })).toBeVisible();
    await expectNoOverflow(page);
    await expectControlsAreUsable(page);
    await capture(page, 'production-events-mobile', false);
    monitor.assertClean();
  });
});
