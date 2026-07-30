import { expect, test, type Page } from '@playwright/test';

type Role = 'cco' | 'sales_manager' | 'viewer';

const eventId = '11111111-1111-4111-8111-111111111111';
const leadId = '22222222-2222-4222-8222-222222222222';

const people = {
  cco: {
    id: 'cco-1',
    email: 'cco@customer.test',
    name: 'Chief Commercial Officer',
    role: 'cco',
    tenantKey: 'default',
  },
  sales_manager: {
    id: 'sales-1',
    email: 'sales@customer.test',
    name: 'Sales Manager',
    role: 'sales_manager',
    tenantKey: 'default',
  },
  viewer: {
    id: 'viewer-1',
    email: 'viewer@customer.test',
    name: 'Commercial Viewer',
    role: 'viewer',
    tenantKey: 'default',
  },
};

const eventRecord = {
  id: eventId,
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

const lead = {
  id: leadId,
  eventId,
  leadName: 'Nadia Hassan',
  leadEmail: 'nadia@customer.test',
  leadPhone: '+971500000001',
  leadStatus: 'qualified',
  leadTemperature: 'hot',
  consentStatus: 'granted',
  sourceOfTruth: 'gohighlevel',
  externalSourceProvider: 'gohighlevel',
  externalContactId: 'ghl-contact-1',
  saleValue: 1000,
  amountPaid: 400,
  paymentStatus: 'partial',
  paymentDate: '2026-07-27T00:00:00.000Z',
};

function dashboardBody() {
  return {
    event: eventRecord,
    kpis: {
      plannedBudget: 5000,
      actualSpend: 2100,
      budgetVariance: 2900,
      newLeads: 1,
      capturedLeads: 1,
      meetingsBooked: 1,
      meetingsAttended: 0,
      noShows: 0,
      noShowRate: 0,
      purchases: 0,
    },
    sourceStatus: { primarySource: 'connector', connectorRecords: 1, importedRecords: 0 },
    funnel: [{ label: 'Leads', value: 1 }],
    channelPerformance: [],
    leadTemperature: [{ label: 'Hot', value: 1 }],
    nextActions: [
      {
        title: 'Follow up with Nadia',
        detail: 'Prepare the next approved CRM action.',
        priority: 'high',
      },
    ],
    kpiRecords: [],
  };
}

function publicOperation(
  role: Role,
  status: 'previewed' | 'pending_approval' | 'approved' = 'previewed',
) {
  const restricted = role === 'viewer';
  return {
    id: 'operation-1',
    eventId,
    leadId,
    operationType: restricted ? 'restricted' : 'opportunity_upsert',
    status,
    reconciliationStatus: 'not_started',
    version: status === 'previewed' ? 1 : status === 'pending_approval' ? 2 : 3,
    previewHash: restricted ? undefined : 'preview-hash',
    preview: restricted
      ? undefined
      : {
          summary: {
            title: 'Update sale and payment',
            customer: 'Nadia Hassan',
            pipeline: 'Marketing Pipeline',
            stage: 'Sale',
            totalSaleValue: 2000,
            amountPaid: 2000,
            outstandingBalance: 0,
            paymentStatus: 'paid_in_full',
            ticketQuantity: 2,
          },
          blockers: [],
        },
    createdAt: '2026-07-29T10:00:00.000Z',
    updatedAt: '2026-07-29T10:00:00.000Z',
  };
}

async function installMocks(
  page: Page,
  role: Role,
  options: { existingOperation?: boolean } = {},
) {
  const unexpected: string[] = [];
  const failures: string[] = [];
  const browserProblems: string[] = [];
  let previewCalls = 0;
  let operationStatus: 'previewed' | 'pending_approval' | 'approved' = 'previewed';

  await page.addInitScript(() => window.localStorage.setItem('token', 'ghl-operations-token'));
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      browserProblems.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => browserProblems.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    if (response.url().includes(':4000') && response.status() >= 400) {
      failures.push(`${response.status()} ${response.url()}`);
    }
  });

  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() === 'document') return route.continue();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    const knownPrefixes = [
      '/auth/',
      '/events',
      '/leads',
      '/event-problems',
      '/planner/',
      '/ghl-sync/',
      '/ghl-operations',
      '/closeout/',
      '/learning-recommendations/',
      '/commercial-kpis',
    ];
    if (!knownPrefixes.some((prefix) => path === prefix || path.startsWith(prefix))) {
      return route.continue();
    }

    if (path === '/auth/session') {
      return json({
        user: people[role],
        agentRep: { id: `profile-${role}`, name: people[role].name, status: 'active' },
      });
    }
    if (path === '/events') return json([eventRecord]);
    if (path === `/events/${eventId}/dashboard`) return json(dashboardBody());
    if (path === '/leads') return json([lead]);
    if (path === `/event-problems/dashboard/${eventId}`) {
      return json({ openProblems: 0, criticalOpen: 0, totalProblems: 0 });
    }
    if (path === '/event-problems') return json([]);
    if (path.startsWith(`/planner/events/${eventId}/`)) return json([]);
    if (path === '/ghl-sync/status') {
      return json({
        credentialStatus: 'configured',
        ghlLeadCount: 1,
        acceptance: { status: 'ready_for_read_sync', readyForReadSync: true },
      });
    }
    if (path === `/closeout/events/${eventId}/report`) return json(null);
    if (path === `/learning-recommendations/events/${eventId}`) return json(null);
    if (path.startsWith('/commercial-kpis')) {
      return json(path.endsWith('/capacity') || path.endsWith('/evaluation') ? null : []);
    }
    if (path === '/ghl-operations/reference-data') {
      return json({
        status: 'ready',
        capabilities: {
          prepare: role !== 'viewer',
          approve: role === 'cco',
        },
        executionReadiness: {
          workerEnabled: true,
          operations: {
            contact_upsert: { enabled: true, state: 'live' },
            contact_tags_update: { enabled: true, state: 'live' },
            opportunity_upsert: { enabled: true, state: 'live' },
            appointment_upsert: { enabled: true, state: 'live' },
            whatsapp_send: { enabled: false, state: 'approval_only' },
          },
          webhook: {
            enabled: false,
            liveVerified: false,
            state: 'setup_required',
          },
        },
        pipelines: [
          {
            id: 'pipeline-1',
            name: 'Marketing Pipeline',
            approved: true,
            stages: [{ id: 'stage-sale', name: 'Sale', approved: true }],
          },
        ],
        tags: [{ id: 'tag-1', name: 'buyer', approved: true }],
        calendars: [{ id: 'calendar-1', name: 'Sales Calendar', approved: true }],
      });
    }
    if (path === '/ghl-operations' && method === 'GET') {
      return json(
        role === 'viewer'
          ? [publicOperation(role, 'approved')]
          : options.existingOperation
            ? [publicOperation(role, 'previewed')]
            : [],
      );
    }
    if (path === '/ghl-operations/preview' && method === 'POST') {
      previewCalls += 1;
      operationStatus = 'previewed';
      return json(publicOperation(role, operationStatus), 201);
    }
    if (path === '/ghl-operations/operation-1/submit' && method === 'POST') {
      operationStatus = 'pending_approval';
      return json(publicOperation(role, operationStatus));
    }
    if (path === '/ghl-operations/operation-1/decision' && method === 'POST') {
      operationStatus = 'approved';
      return json(publicOperation(role, operationStatus));
    }

    unexpected.push(`${method} ${path}${url.search}`);
    return json({ error: `Unexpected GHL operations request: ${method} ${path}` }, 500);
  });

  return {
    assertClean() {
      expect(unexpected, 'GHL operations UI must not call unrelated APIs').toEqual([]);
      expect(failures, 'GHL operations UI must not receive failed API responses').toEqual([]);
      expect(browserProblems, 'GHL operations UI must not emit console errors or warnings').toEqual(
        [],
      );
    },
    previewCalls() {
      return previewCalls;
    },
  };
}

async function openLeadsTab(page: Page) {
  await page.goto(`/events/${eventId}`);
  await page
    .getByRole('navigation', { name: 'Event workspace views' })
    .getByRole('button', { name: 'Leads' })
    .click();
  await expect(page.getByRole('heading', { name: 'Take action in GoHighLevel' })).toBeVisible();
}

test.describe('GHL two-way commercial operations', () => {
  test('sales manager prepares a governed payment update without leaking action data', async ({
    page,
  }) => {
    const monitor = await installMocks(page, 'sales_manager');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await openLeadsTab(page);

    await page.getByRole('tab', { name: /Sale & payment/ }).click();
    const form = page.getByRole('tabpanel', { name: /Sale & payment/ });
    await form.getByRole('combobox', { name: 'Pipeline', exact: true }).selectOption('pipeline-1');
    await form.getByRole('combobox', { name: 'Stage', exact: true }).selectOption('stage-sale');
    await form.getByRole('combobox', { name: 'Status', exact: true }).selectOption('won');
    await form.getByRole('spinbutton', { name: 'Total sale value' }).fill('2000');
    await form.getByRole('spinbutton', { name: 'Amount paid' }).fill('2000');
    await form.getByRole('spinbutton', { name: 'Ticket quantity' }).fill('2');
    await form
      .getByRole('combobox', { name: 'Payment status', exact: true })
      .selectOption('paid_in_full');
    await form.getByLabel('Payment date').fill('2026-07-29');
    await page.getByRole('button', { name: 'Review change' }).click();

    await expect(page.getByRole('heading', { name: 'Update sale and payment' })).toBeVisible();
    await expect(page.getByText('2000').first()).toBeVisible();
    await page.getByRole('button', { name: 'Send for approval' }).click();
    await expect(page.getByText('Pending Approval')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve' })).toHaveCount(0);
    expect(page.url()).not.toContain('amountPaid');
    expect(page.url()).not.toContain('action=');

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    monitor.assertClean();
  });

  test('shows selectively enabled CRM work while WhatsApp remains approval-only', async ({
    page,
  }) => {
    const monitor = await installMocks(page, 'cco');
    await openLeadsTab(page);

    await expect(
      page.getByRole('tab', { name: /Customer.*Live after approval/ }),
    ).toBeVisible();
    await expect(
      page.getByRole('tab', { name: /Sale & payment.*Live after approval/ }),
    ).toBeVisible();
    await page.getByRole('tab', { name: /WhatsApp.*Approval only/ }).click();
    await expect(
      page.getByText(
        'WhatsApp sending is not available yet. You can prepare and approve a message, but it will not be sent.',
      ),
    ).toBeVisible();
    monitor.assertClean();
  });

  test('CCO sees consequential details and approves without executing in the browser', async ({
    page,
  }) => {
    const monitor = await installMocks(page, 'cco');
    await page.setViewportSize({ width: 1366, height: 900 });
    await openLeadsTab(page);

    await page.getByRole('tab', { name: /Sale & payment/ }).click();
    const form = page.getByRole('tabpanel', { name: /Sale & payment/ });
    await form.getByRole('combobox', { name: 'Pipeline', exact: true }).selectOption('pipeline-1');
    await form.getByRole('combobox', { name: 'Stage', exact: true }).selectOption('stage-sale');
    await form.getByRole('combobox', { name: 'Status', exact: true }).selectOption('won');
    await form.getByRole('spinbutton', { name: 'Total sale value' }).fill('2000');
    await form.getByRole('spinbutton', { name: 'Amount paid' }).fill('2000');
    await form.getByRole('spinbutton', { name: 'Ticket quantity' }).fill('2');
    await form
      .getByRole('combobox', { name: 'Payment status', exact: true })
      .selectOption('paid_in_full');
    await form.getByLabel('Payment date').fill('2026-07-29');
    await page.getByRole('button', { name: 'Review change' }).click();
    await page.getByRole('button', { name: 'Send for approval' }).click();
    await page.getByRole('button', { name: 'Approve' }).click();

    await expect(page.getByText('Approved and queued.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Execute|Reconcile/ })).toHaveCount(0);
    monitor.assertClean();
  });

  test('prefills saved payment date and blocks an incomplete partial payment before the API', async ({
    page,
  }) => {
    const monitor = await installMocks(page, 'cco');
    await openLeadsTab(page);

    await page.getByRole('tab', { name: /Sale & payment/ }).click();
    const form = page.getByRole('tabpanel', { name: /Sale & payment/ });
    const paymentDate = form.getByLabel(/Payment date/);
    await expect(paymentDate).toHaveValue('2026-07-27');

    await form
      .getByRole('combobox', { name: 'Payment status', exact: true })
      .selectOption('partial');
    await expect(form.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('won');
    await paymentDate.fill('');
    await page.getByRole('button', { name: 'Review change' }).click();

    await expect(
      page.getByText('Enter the payment date before reviewing a partial payment.'),
    ).toBeVisible();
    expect(monitor.previewCalls()).toBe(0);
    monitor.assertClean();
  });

  test('blocks a paid sale changed back to Open before calling the API', async ({ page }) => {
    const monitor = await installMocks(page, 'cco');
    await openLeadsTab(page);

    await page.getByRole('tab', { name: /Sale & payment/ }).click();
    const form = page.getByRole('tabpanel', { name: /Sale & payment/ });
    await form.getByRole('combobox', { name: 'Status', exact: true }).selectOption('open');
    await page.getByRole('button', { name: 'Review change' }).click();

    await expect(
      page.getByText('Set opportunity status to Won for a partial or fully paid sale.'),
    ).toBeVisible();
    expect(monitor.previewCalls()).toBe(0);
    monitor.assertClean();
  });

  test('blocks a received amount without an explicit payment status before the API', async ({
    page,
  }) => {
    const monitor = await installMocks(page, 'cco');
    await openLeadsTab(page);

    await page.getByRole('tab', { name: /Sale & payment/ }).click();
    const form = page.getByRole('tabpanel', { name: /Sale & payment/ });
    await form.getByRole('combobox', { name: 'Payment status', exact: true }).selectOption('unknown');
    await page.getByRole('button', { name: 'Review change' }).click();

    await expect(
      page.getByText('Choose Partially paid or Paid in full when an amount has been received.'),
    ).toBeVisible();
    expect(monitor.previewCalls()).toBe(0);
    monitor.assertClean();
  });

  test('viewer receives restricted history without mutation controls or hidden 403s', async ({
    page,
  }) => {
    const monitor = await installMocks(page, 'viewer');
    await page.setViewportSize({ width: 390, height: 844 });
    await openLeadsTab(page);

    await expect(page.getByText(/Preparing CRM changes is limited/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Review change' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Recent customer actions' })).toBeVisible();
    await expect(page.getByText('Restricted')).toBeVisible();
    await expect(page.getByText('preview-hash')).toHaveCount(0);

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    monitor.assertClean();
  });

  test('opens the exact customer and CRM command returned by Stitchi', async ({ page }) => {
    const monitor = await installMocks(page, 'cco', { existingOperation: true });
    await page.goto(
      `/events/${eventId}?leadId=${leadId}&ghlOperationId=operation-1`,
    );

    await expect(
      page.getByRole('navigation', { name: 'Event workspace views' })
        .getByRole('button', { name: 'Leads' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(
      page.getByRole('tab', { name: /Sale & payment/ }),
    ).toHaveAttribute('aria-selected', 'true');
    await expect(
      page.getByRole('heading', { name: 'Update sale and payment' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Review Opportunity Upsert action' }),
    ).toHaveClass(/is-selected/);
    monitor.assertClean();
  });
});
