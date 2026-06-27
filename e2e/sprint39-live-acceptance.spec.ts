import { expect, test } from '@playwright/test';

const acceptanceEnabled = process.env.E2E_ACCEPTANCE === 'true';
const apiBaseUrl = process.env.E2E_API_BASE_URL || 'http://localhost:4000';
const email = process.env.E2E_USER_EMAIL || 'admin@tanaghum.com';
const password = process.env.E2E_USER_PASSWORD || 'password123';

test.describe('Sprint 39 Commercial/Social live acceptance', () => {
  test.skip(!acceptanceEnabled, 'Set E2E_ACCEPTANCE=true and E2E_BASE_URL to run deployed acceptance checks.');

  test('Command Center loads real acceptance state with no console errors', async ({ page, request }) => {
    const consoleErrors: string[] = [];
    const failedResponses: string[] = [];

    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text());
    });
    page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
    page.on('response', (response) => {
      if (response.url().includes(apiBaseUrl) && response.status() >= 400) {
        failedResponses.push(`${response.status()} ${response.url()}`);
      }
    });

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Open Command Center' }).click();
    await page.waitForURL(/command-center/);
    await expect(page.getByRole('heading', { name: /Commercial Command Center/i })).toBeVisible();
    await expect(page.getByText(/Marketing growth dashboard/i)).toBeVisible();

    await expect.poll(async () => page.locator('body').innerText(), {
      timeout: 20000,
      message: 'Command Center should load nonzero live records',
    }).toMatch(/Active campaigns\s+[1-9]/i);

    const body = await page.locator('body').innerText();
    expect(body).toMatch(/Active campaigns\s+[1-9]/i);
    expect(body).toMatch(/Pending approvals\s+[1-9]/i);
    expect(body).toMatch(/Posts ready\s+[1-9]/i);
    expect(body).toMatch(/Qualified leads\s+[1-9]/i);
    expect(body).toMatch(/Production Writes Locked|External Writes Off/i);
    expect(body).toMatch(/AI model/i);
    expect(body).toMatch(/Postiz server online|Postiz server needs attention/i);

    const loginResponse = await request.post(`${apiBaseUrl}/auth/login`, {
      data: { email, password },
    });
    expect(loginResponse.ok()).toBe(true);
    const login = await loginResponse.json();
    const token = login.token as string;

    const aiStatus = await request.get(`${apiBaseUrl}/ai-provider/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(aiStatus.ok()).toBe(true);
    const ai = await aiStatus.json();
    expect(ai.credentialStorage.rawKeysReturned).toBe(false);

    const postizChannels = await request.get(`${apiBaseUrl}/postiz/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect([200, 424]).toContain(postizChannels.status());
    const channels = await postizChannels.json();
    expect(channels.rawTokensReturned).toBe(false);
    expect(channels.guidance || channels.required).toBeTruthy();

    expect(consoleErrors).toEqual([]);
    expect(failedResponses).toEqual([]);
  });

  test('real LLM provider is active when Sprint 39B requires it', async ({ request }) => {
    test.skip(process.env.E2E_REQUIRE_REAL_LLM !== 'true', 'Set E2E_REQUIRE_REAL_LLM=true after saving and testing a real provider key.');

    const loginResponse = await request.post(`${apiBaseUrl}/auth/login`, {
      data: { email, password },
    });
    expect(loginResponse.ok()).toBe(true);
    const token = (await loginResponse.json()).token as string;

    const aiStatus = await request.get(`${apiBaseUrl}/ai-provider/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(aiStatus.ok()).toBe(true);
    const ai = await aiStatus.json();
    expect(ai.activeProvider).not.toBe('mock');
    const active = ai.providers.find((provider: { type: string }) => provider.type === ai.activeProvider);
    expect(active?.apiKeyStatus).toBe('configured');

    const providerTest = await request.post(`${apiBaseUrl}/ai-provider/test`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { provider: ai.activeProvider },
    });
    expect(providerTest.ok()).toBe(true);
    await expect(providerTest.json()).resolves.toMatchObject({
      status: 'connected',
      rawKeyReturned: false,
    });
  });

  test('Postiz channel is selected when sandbox scheduling acceptance requires it', async ({ request }) => {
    test.skip(process.env.E2E_REQUIRE_POSTIZ_CHANNEL !== 'true', 'Set E2E_REQUIRE_POSTIZ_CHANNEL=true after connecting and selecting a Postiz channel.');

    const loginResponse = await request.post(`${apiBaseUrl}/auth/login`, {
      data: { email, password },
    });
    expect(loginResponse.ok()).toBe(true);
    const token = (await loginResponse.json()).token as string;

    const postizChannels = await request.get(`${apiBaseUrl}/postiz/channels`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(postizChannels.ok()).toBe(true);
    const body = await postizChannels.json();
    expect(body.count).toBeGreaterThan(0);
    expect(body.selectedIntegrationId).toBeTruthy();
    expect(body.rawTokensReturned).toBe(false);
  });
});
