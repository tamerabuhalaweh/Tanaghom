import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const acceptanceEnabled = process.env.E2E_SPRINT65_ACCEPTANCE === 'true' || process.env.E2E_ACCEPTANCE === 'true';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4000';
const email = process.env.E2E_USER_EMAIL || 'admin@tanaghum.com';
const password = process.env.E2E_USER_PASSWORD || 'password123';
const allowWrites = process.env.E2E_ALLOW_ACCEPTANCE_WRITES === 'true';
const requireRealAi = process.env.E2E_REQUIRE_REAL_AI === 'true';

type JsonObject = Record<string, unknown>;

const uuidPattern = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const secretPattern = /(sk-[A-Za-z0-9_-]{12,}|ghp_[A-Za-z0-9_]{12,}|x-api-key|access_token["']?\s*[:=]\s*["'][^"']{8,}|apiKey["']?\s*[:=]\s*["'][^"']{8,}|botToken["']?\s*[:=]\s*["'][^"']{8,})/i;

function api(path: string): string {
  return `${apiBaseUrl}${path}`;
}

async function jsonOrEmpty(response: Awaited<ReturnType<APIRequestContext['get']>>): Promise<unknown> {
  return response.json().catch(() => ({}));
}

function expectNoSecretLeak(payload: unknown, label: string) {
  expect(JSON.stringify(payload), `${label} must not expose raw secrets`).not.toMatch(secretPattern);
}

async function loginByApi(request: APIRequestContext): Promise<string> {
  const response = await request.post(api('/auth/login'), {
    data: { email, password },
  });
  expect(response.ok(), `API login failed with ${response.status()}`).toBe(true);
  const body = await response.json() as { token?: string };
  expect(body.token, 'Login response must include token').toBeTruthy();
  expectNoSecretLeak(body, 'login response');
  return String(body.token);
}

async function getOrCreateEvent(request: APIRequestContext, token: string): Promise<JsonObject> {
  const listResponse = await request.get(api('/events'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(listResponse.ok(), `GET /events failed with ${listResponse.status()}`).toBe(true);
  const events = await listResponse.json() as JsonObject[];
  expectNoSecretLeak(events, 'events list');

  if (events.length) return events[0];
  expect(allowWrites, 'No event exists. Set E2E_ALLOW_ACCEPTANCE_WRITES=true to create an acceptance event.').toBe(true);

  const createdResponse = await request.post(api('/events'), {
    headers: { Authorization: `Bearer ${token}` },
    data: {
      name: `Sprint 65 Acceptance Event ${Date.now()}`,
      eventType: 'tagyeer_wa_irtaqi',
      eventDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      location: 'Acceptance Sandbox',
      expectedAttendance: 200,
      revenueTarget: 120000,
      plannedBudget: 35000,
      offer: 'Two-day live course acceptance test event.',
      audience: 'Warm followers and existing customers.',
      geography: 'GCC and Jordan',
      fomoAngle: 'Limited seats and date-based urgency.',
      upsellPlan: 'Email and WhatsApp follow-up after approval.',
      selectedChannels: ['instagram', 'meta_ads', 'email', 'whatsapp'],
      contentDepartmentRequirements: 'Reels, testimonials, reminders, and registration assets.',
      salesTeamRequirements: 'Qualify leads, answer questions, book meetings, recover no-shows.',
    },
  });
  expect(createdResponse.ok(), `POST /events failed with ${createdResponse.status()}`).toBe(true);
  const created = await createdResponse.json() as JsonObject;
  expectNoSecretLeak(created, 'created event');
  return created;
}

async function assertOkJson(request: APIRequestContext, token: string, path: string, label: string): Promise<unknown> {
  const response = await request.get(api(path), {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `${label} failed with ${response.status()} ${path}`).toBe(true);
  const body = await jsonOrEmpty(response);
  expectNoSecretLeak(body, label);
  return body;
}

async function monitorCustomerPath(page: Page) {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('response', (response) => {
    const url = response.url();
    const status = response.status();
    if (!url.includes(apiBaseUrl) && !url.includes('/api/')) return;

    const allowedCredentialBlockedResponse =
      status === 400 || status === 409 || status === 424
        ? /postiz|ghl|smartlabs|connector|integration|runtime-bridges|social-oauth/i.test(url)
        : false;

    if (status >= 400 && !allowedCredentialBlockedResponse) {
      failedResponses.push(`${status} ${url}`);
    }
  });

  return {
    assertClean() {
      expect(consoleErrors, 'No console or page errors expected').toEqual([]);
      expect(failedResponses, 'No unexpected failed API responses expected').toEqual([]);
    },
  };
}

async function expectCustomerPage(page: Page, path: string, heading: RegExp | string, supportingText: RegExp | string) {
  await page.goto(path);
  const main = page.locator('main');
  await expect(main.getByRole('heading', { name: heading }).first()).toBeVisible({ timeout: 20000 });
  await expect(main.getByText(supportingText).first()).toBeVisible({ timeout: 20000 });
  const body = await main.innerText();
  expect(body, `${path} should not show raw UUIDs in the customer path`).not.toMatch(uuidPattern);
  expect(body, `${path} should not show obvious raw JSON blocks`).not.toMatch(/^\s*[{[]\s*"/m);
  expect(body, `${path} should not expose raw secrets`).not.toMatch(secretPattern);
}

test.describe('Sprint 65 customer acceptance and deployed release gate', () => {
  test.describe.configure({ mode: 'serial' });

  test.skip(!acceptanceEnabled, 'Set E2E_SPRINT65_ACCEPTANCE=true or E2E_ACCEPTANCE=true with E2E_BASE_URL and E2E_API_BASE_URL to run Sprint 65 acceptance.');

  test('15-minute customer path loads without console errors or unexpected failed API responses', async ({ page, request }) => {
    const monitor = await monitorCustomerPath(page);
    const token = await loginByApi(request);
    const event = await getOrCreateEvent(request, token);
    const eventId = String(event.id || '');
    expect(eventId, 'Acceptance requires an existing or newly created event').toBeTruthy();

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Open Command Center' }).click();
    await expect.poll(() => page.evaluate(() => localStorage.getItem('token')), {
      message: 'frontend login should store a session token before protected navigation',
      timeout: 20000,
    }).toBeTruthy();
    await page.waitForURL(/\/(command-center|dashboard)(?:$|[?#])/);
    await expect(page.getByRole('heading', { name: /^Dashboard$/i })).toBeVisible({ timeout: 20000 });

    await expectCustomerPage(page, '/events', /^Events$/i, /Event Queue|No events yet/i);
    await expectCustomerPage(page, '/events/new', /Create Event Strategy/i, /What Happens After Saving/i);
    await expectCustomerPage(page, `/events/${eventId}`, /^Events$/i, /Event Campaign Planner/i);
    await expect(page.getByRole('heading', { name: /Sales Workflow/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Post-Event Closeout Report/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Connector Data Status/i })).toBeVisible();

    await expectCustomerPage(page, '/ideas', /Content Creator/i, /Campaign Brief/i);
    if (requireRealAi) {
      await expect(page.getByRole('button', { name: /Generate Campaign Ideas/i })).toBeEnabled();
    } else {
      await expect(page.getByText(/Connect AI Model|Generate Campaign Ideas/i).first()).toBeVisible();
    }

    await expectCustomerPage(page, '/approvals', /Review & Approve/i, /Human Review|Review Queue|Nothing to show yet/i);
    await expectCustomerPage(page, '/publishing', /Scheduling/i, /Scheduling Service|Scheduling & Review|Postiz/i);
    await expectCustomerPage(page, '/analytics', /Performance/i, /Lead|Customer Interest|Waiting for Data/i);
    await expectCustomerPage(page, '/events/master', /Master Events Dashboard/i, /Event Comparison|No event results yet/i);
    await expectCustomerPage(page, '/integration-credentials', /Connect Business Systems/i, /Start Here: Choose What You Want To Connect/i);

    monitor.assertClean();
  });

  test('backend release-gate endpoints are healthy and do not expose secrets', async ({ request }) => {
    const token = await loginByApi(request);
    const event = await getOrCreateEvent(request, token);
    const eventId = String(event.id || '');
    expect(eventId).toBeTruthy();

    const health = await request.get(api('/health'));
    expect(health.ok(), `GET /health failed with ${health.status()}`).toBe(true);

    await assertOkJson(request, token, '/auth/session', 'session');
    await assertOkJson(request, token, '/events', 'events list');
    await assertOkJson(request, token, `/events/${eventId}/dashboard`, 'event dashboard');
    await assertOkJson(request, token, `/planner/events/${eventId}/email-plans`, 'email planner');
    await assertOkJson(request, token, `/planner/events/${eventId}/whatsapp-plans`, 'whatsapp planner');
    await assertOkJson(request, token, `/planner/events/${eventId}/content-requirements`, 'content requirements');
    await assertOkJson(request, token, `/leads/dashboard/${eventId}`, 'lead lifecycle dashboard');
    await assertOkJson(request, token, '/master-events/dashboard', 'master events dashboard');
    await assertOkJson(request, token, `/closeout/events/${eventId}/report`, 'closeout report');
    await assertOkJson(request, token, '/connector-readiness/global', 'global connector readiness');
    await assertOkJson(request, token, `/connector-readiness/events/${eventId}`, 'event connector readiness');
    await assertOkJson(request, token, '/ops/readiness', 'operations readiness');
    await assertOkJson(request, token, '/ops/backup/status', 'backup status');
    await assertOkJson(request, token, '/ops/monitoring/status', 'monitoring status');
  });

  test('optional write-path acceptance creates an event lead and lifecycle evidence only when explicitly enabled', async ({ request }) => {
    test.skip(!allowWrites, 'Set E2E_ALLOW_ACCEPTANCE_WRITES=true only on an approved sandbox/test tenant.');

    const token = await loginByApi(request);
    const event = await getOrCreateEvent(request, token);
    const eventId = String(event.id || '');

    const createLead = await request.post(api('/leads'), {
      headers: { Authorization: `Bearer ${token}` },
      data: {
        eventId,
        leadName: `Sprint 65 Acceptance Lead ${Date.now()}`,
        leadEmail: `acceptance-${Date.now()}@example.com`,
        leadPhone: '+962790000000',
        leadStatus: 'new_lead',
        leadTemperature: 'warm',
        audienceSource: 'follower',
        channelAttribution: 'instagram',
        platform: 'instagram',
        salesNotes: 'Created by Sprint 65 acceptance workflow.',
        nextAction: 'Follow up after customer acceptance run.',
      },
    });
    expect(createLead.ok(), `POST /leads failed with ${createLead.status()}`).toBe(true);
    const lead = await createLead.json() as JsonObject;
    expectNoSecretLeak(lead, 'created lead');

    const leadId = String(lead.id || '');
    expect(leadId).toBeTruthy();

    const transition = await request.post(api(`/leads/${leadId}/transition`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { toStatus: 'contacted', reason: 'Sprint 65 acceptance lifecycle smoke.' },
    });
    expect(transition.ok(), `Lead transition failed with ${transition.status()}`).toBe(true);
    expectNoSecretLeak(await transition.json(), 'lead transition');

    const dashboard = await assertOkJson(request, token, `/leads/dashboard/${eventId}`, 'lead dashboard after write') as JsonObject;
    expect(JSON.stringify(dashboard)).toMatch(/contacted|total/i);
  });
});
