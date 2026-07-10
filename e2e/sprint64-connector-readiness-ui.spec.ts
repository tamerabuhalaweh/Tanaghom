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

async function installConnectorSetupMocks(page: Page) {
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

    if (pathname === '/integration-status') {
      await json({
        aiProvider: { provider: 'deepseek', label: 'Live Provider Active' },
        connectors: [
          {
            id: 'postiz',
            name: 'Postiz',
            credentialStatus: 'configured',
            endpointStatus: 'reachable',
            executionPolicy: { label: 'Publishing Controlled', reasons: ['Human approval required'] },
          },
          {
            id: 'gohighlevel',
            name: 'GoHighLevel',
            credentialStatus: 'missing',
            endpointStatus: 'not_checked',
            executionPolicy: { label: 'Write Back Blocked', reasons: ['Customer credentials required'] },
          },
        ],
      });
      return;
    }

    if (pathname === '/postiz/status') {
      await json({
        status: 'reachable',
        health: {
          credentialStatus: 'configured',
          integrationIdStatus: 'configured',
        },
      });
      return;
    }

    if (pathname === '/postiz/channels') {
      await json({
        status: 'connected',
        selectedIntegrationId: 'postiz-channel-1',
        channels: [
          {
            id: 'postiz-channel-1',
            name: 'Moataz Instagram Business',
            providerIdentifier: 'instagram',
            profile: '@moataz_mashal_test',
            disabled: false,
            refreshNeeded: false,
          },
        ],
      });
      return;
    }

    if (pathname === '/postiz/diagnostics') {
      await json({
        status: 'ready',
        authorization: {
          providerConfigurationReady: true,
          clientIdStatus: 'configured',
          authorizationUrl: 'https://postiz.example.test/oauth',
        },
        diagnostics: {
          status: 'ready',
          title: 'Postiz channel diagnostics',
          summary: 'Provider app and channel selection are ready.',
          checks: [
            { id: 'api', label: 'API key', status: 'configured', detail: 'Tenant-owned credential exists.' },
            { id: 'channel', label: 'Channel', status: 'connected', detail: 'A Postiz channel is selected.' },
          ],
          nextActions: ['Prepare scheduling package from approved content.'],
        },
      });
      return;
    }

    if (pathname === '/ghl/status') {
      await json({ _label: 'Requires customer API key', apiKeyStatus: 'missing' });
      return;
    }

    if (pathname === '/integration-credentials/matrix') {
      await json({
        rows: [
          {
            provider: 'postiz',
            credentialType: 'api_key',
            connectionKey: 'default',
            label: 'Postiz',
            purpose: 'Scheduling workspace owned by the customer.',
            status: 'configured',
            requiredFields: ['apiKey', 'baseUrl'],
            optionalFields: ['integrationId'],
          },
          {
            provider: 'gohighlevel',
            credentialType: 'api_key',
            connectionKey: 'default',
            label: 'GoHighLevel',
            purpose: 'CRM lead handoff owned by the customer.',
            status: 'missing',
            requiredFields: ['apiKey', 'locationId'],
            optionalFields: [],
          },
          {
            provider: 'social_oauth',
            credentialType: 'oauth_client',
            connectionKey: 'meta',
            label: 'Meta OAuth',
            purpose: 'Instagram and Facebook account authorization.',
            status: 'configured',
            requiredFields: ['clientId', 'clientSecret', 'redirectUri'],
            optionalFields: [],
          },
          {
            provider: 'smartlabs_voice',
            credentialType: 'api_key',
            connectionKey: 'default',
            label: 'SmartLabs Voice',
            purpose: 'Voice and chat agent handoff.',
            status: 'configured',
            requiredFields: ['apiKey'],
            optionalFields: ['baseUrl', 'agentId'],
          },
          {
            provider: 'openclaw',
            credentialType: 'runtime_endpoint',
            connectionKey: 'default',
            label: 'OpenClaw',
            purpose: 'Adjacent orchestration runtime.',
            status: 'missing',
            requiredFields: ['endpointUrl', 'apiKey'],
            optionalFields: [],
          },
        ],
      });
      return;
    }

    if (pathname === '/integration-credentials') {
      await json({
        credentials: [
          {
            id: 'credential-1',
            displayName: 'Postiz Production Sandbox',
            provider: 'postiz',
            credentialType: 'api_key',
            connectionKey: 'default',
            secretFields: ['apiKey', 'baseUrl'],
            secretFingerprints: { apiKey: 'sha256:postiz...', baseUrl: 'sha256:url...' },
            isActive: true,
          },
        ],
      });
      return;
    }

    if (pathname === '/social-oauth/connections') {
      await json({
        connections: [
          {
            platform: 'meta',
            accountName: 'Moataz Meta Business',
            accountId: 'meta-business-1',
            scopes: ['pages_read_engagement', 'instagram_basic'],
            refreshTokenStatus: 'configured',
            status: 'active',
          },
        ],
      });
      return;
    }

    if (pathname === '/runtime-bridges/status') {
      await json({
        statuses: [
          { provider: 'openclaw', configured: false, reachable: false, label: 'Requires endpoint credentials', rawSecretsReturned: false },
          { provider: 'agentgateway', configured: false, reachable: false, label: 'Requires endpoint credentials', rawSecretsReturned: false },
          { provider: 'agentscope', configured: false, reachable: false, label: 'Requires endpoint credentials', rawSecretsReturned: false },
        ],
      });
      return;
    }

    if (pathname === '/connector-imports/readiness') {
      await json({
        tenantKey: 'default',
        totalConfigured: 2,
        totalMissing: 6,
        totalBlocked: 0,
        connectors: [
          {
            connectorId: 'postiz',
            label: 'Postiz',
            jobState: 'test_passed',
            credentialState: 'configured',
            jobId: 'job-postiz',
          },
          {
            connectorId: 'gohighlevel',
            label: 'GoHighLevel',
            jobState: 'requires_credentials',
            credentialState: 'customer_credential_missing',
            jobId: null,
          },
          {
            connectorId: 'smartlabs_voice',
            label: 'SmartLabs Voice',
            jobState: 'ready_for_test',
            credentialState: 'configured',
            jobId: 'job-smartlabs',
          },
        ],
      });
      return;
    }

    if (pathname === '/connector-imports/jobs' && method === 'GET') {
      await json([
        {
          id: 'job-postiz',
          connectorId: 'postiz',
          displayName: 'Postiz event KPI import',
          state: 'test_passed',
          credentialState: 'configured',
          lastDryRunAt: '2026-07-02T12:00:00.000Z',
        },
      ]);
      return;
    }

    await json({});
  });
}

test('Sprint 64E connector setup readiness UI is usable and secret-safe', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));

  await installConnectorSetupMocks(page);
  await page.addInitScript(() => localStorage.setItem('token', 'e2e-token'));

  await page.goto('/integration-credentials');

  await expect(page.getByRole('heading', { name: /Connect Business Systems/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Setup Wizard: Choose A Data Source/i })).toBeVisible();
  await expect(page.getByText(/customer-owned systems that power the platform/i)).toBeVisible();

  await expect(page.getByRole('button', { name: /Postiz Scheduling/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /Meta \/ Instagram Ads/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /GoHighLevel CRM/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Voice Agent SmartLabs Voice/i })).toBeVisible();

  await expect(page.getByText(/Credentials saved/i).first()).toBeVisible();
  await expect(page.getByText(/Requires Customer API Key/i).first()).toBeVisible();
  await expect(page.getByText(/Channel selected/i)).toBeVisible();
  await expect(page.getByText(/OAuth connected/i)).toBeVisible();
  await expect(page.getByText(/Live Provider Active/i)).toBeVisible();

  await expect(page.getByRole('heading', { name: /Secure Setup: GoHighLevel/i })).toBeVisible();
  await expect(page.getByText(/Raw secrets are encrypted and never shown again/i)).toBeVisible();
  await expect(page.getByRole('button', { name: /Save Encrypted Credential/i })).toBeVisible();

  await expect(page.getByText(/sk_live|sk-[a-z0-9]/i)).toHaveCount(0);
  expect(consoleErrors).toEqual([]);
});
