import { expect, test, type Page } from '@playwright/test';

type Role = 'marketing_manager' | 'cco';

const people = {
  marketing_manager: { id: 'manager-1', email: 'marketing@customer.test', name: 'Marketing Manager', role: 'marketing_manager', tenantKey: 'default' },
  cco: { id: 'cco-1', email: 'approver@customer.test', name: 'Content Approver', role: 'cco', tenantKey: 'default' },
};

const campaign = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  topic: 'Leadership Course Launch',
  objective: 'Turn warm followers into qualified course registrations.',
  audience: 'Entrepreneurs and previous buyers in the GCC.',
  cta: 'Reserve your place.',
  targetPlatforms: ['instagram'],
  riskCategory: 'low',
  status: 'drafting',
};

const draft = {
  contentItemId: '550e8400-e29b-41d4-a716-446655440001',
  campaignRequestId: campaign.id,
  platform: 'instagram',
  contentType: 'carousel',
  draftText: 'Leadership begins before confidence arrives. Choose the next right action and reserve your place.',
  versionNo: 1,
  status: 'drafting',
  riskNotes: 'No unsupported outcome promise detected.',
};

const approvalId = '550e8400-e29b-41d4-a716-446655440002';
const packageId = '550e8400-e29b-41d4-a716-446655440003';

async function installMocks(page: Page, role: Role) {
  let approvalStatus = 'pending';
  let packages: Record<string, unknown>[] = [];
  const unexpected: string[] = [];
  const failedResponses: string[] = [];
  const browserProblems: string[] = [];

  await page.addInitScript(() => window.localStorage.setItem('token', 'ux-r1d3-production-token'));
  page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(`${message.type()}: ${message.text()}`); });
  page.on('pageerror', error => browserProblems.push(`pageerror: ${error.message}`));
  page.on('response', response => { if (response.url().includes(':4000') && response.status() >= 400) failedResponses.push(`${response.status()} ${response.url()}`); });

  await page.route('**/*', async route => {
    const request = route.request();
    if (request.resourceType() === 'document') return route.continue();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    const apiPrefixes = ['/auth/', '/ai-provider/', '/campaigns', '/ideas/', '/ai-generation/', '/algo/', '/approvals', '/publishing-package/', '/postiz/', '/commercial-workflow/', '/events', '/postiz-channels/'];
    if (!apiPrefixes.some(prefix => path === prefix || path.startsWith(prefix))) return route.continue();

    if (path === '/auth/session') return json({ user: people[role], agentRep: { id: `profile-${role}`, name: people[role].name, status: 'active' } });
    if (path === '/auth/logout') return json({ ok: true });
    if (path === '/ai-provider/status') return json({
      activeProvider: 'gemma',
      providers: [{
        type: 'gemma',
        name: 'Gemma',
        model: 'gemma4',
        configured: true,
        apiKeyStatus: 'configured',
      }],
    });
    if (path === '/campaigns' && method === 'GET') return json([campaign]);
    if (path === `/campaigns/${campaign.id}` && method === 'GET') return json(campaign);
    if (path === '/ideas/generate' && method === 'POST') return json({ workflow: { threadId: 'idea-thread-1', status: 'waiting' }, ideas: [{ id: 'idea-1', title: 'Lead Before You Feel Ready', hook: 'Confidence often follows the first courageous decision.', platform: 'instagram', format: 'carousel', hashtags: ['leadership'], estimatedReach: 'high', rationale: 'Matches the requested audience and conversion goal.' }], provider: 'gemma', model: 'gemma4', apiKeyStatus: 'configured', generationMode: 'provider' });
    if (path === '/ideas/workflows/idea-thread-1/resume' && method === 'POST') return json({ threadId: 'idea-thread-1', status: 'selected', selectedIdeaId: 'idea-1' });
    if (path === '/ideas/convert-to-campaign' && method === 'POST') return json({ campaignId: campaign.id, title: campaign.topic, status: 'idea' });
    if (path === '/ai-generation/generate' && method === 'POST') return json([draft], 201);
    if (path === `/ai-generation/campaigns/${campaign.id}/drafts` && method === 'GET') return json([draft]);
    if (path === '/ai-generation/save-edit' && method === 'POST') return json({ ...draft, versionNo: 2, draftText: (request.postDataJSON() as { draftText: string }).draftText });
    if (path === '/algo/score' && method === 'POST') return json({ totalScore: 86, bandLabel: 'Ready for review', blockReasons: [] });
    if (path === '/approvals' && method === 'POST') return json({ id: approvalId, targetType: 'content_item', targetId: draft.contentItemId, approvalStatus: 'pending', riskCategory: 'low', requiredRole: 'reviewer' }, 201);
    if (path === '/approvals' && method === 'GET') return json([{ id: approvalId, targetType: 'content_item', targetId: draft.contentItemId, approvalStatus, riskCategory: 'low', requiredRole: 'cco', createdAt: '2026-07-10T10:00:00.000Z' }]);
    if (path === `/approvals/${approvalId}/decision-packet` && method === 'GET') return json({ campaign, contentItem: { id: draft.contentItemId, platform: 'instagram', reachScore: 86, riskReason: draft.riskNotes }, latestDraftVersion: { versionNo: 2, text: draft.draftText }, publishingPackages: packages });
    if (path === `/approvals/${approvalId}/approve` && method === 'POST') { approvalStatus = 'approved'; return json({ id: approvalId, approvalStatus }); }
    if (path === `/approvals/${approvalId}/reject` && method === 'POST') { approvalStatus = 'rejected'; return json({ id: approvalId, approvalStatus }); }
    if (path === `/approvals/${approvalId}/request-changes` && method === 'POST') { approvalStatus = 'changes_requested'; return json({ id: approvalId, approvalStatus }); }
    if (path === '/publishing-package/create' && method === 'POST') { const created = { id: packageId, campaignId: campaign.id, contentItemId: draft.contentItemId, status: 'ready_for_future_execution', createdAt: '2026-07-10T11:00:00.000Z' }; packages = [created]; return json(created); }
    if (path === '/publishing-package/list' && method === 'GET') return json(packages);
    if (path === '/postiz/status' && method === 'GET') return json({ status: 'ready', health: { credentialStatus: 'configured', integrationIdStatus: 'configured' } });
    if (path === '/postiz/channels' && method === 'GET') return json({ status: 'ready', channels: [{ id: 'channel-instagram', name: 'Instagram Business', profile: '@leadership', type: 'instagram', disabled: false, refreshNeeded: false }] });
    if (path === '/postiz/connectors' && method === 'GET') return json([{ id: 'connector-1', connectorName: 'Scheduling service', connectorStatus: 'active', supportsSchedule: true }]);
    if (path === '/commercial-workflow/evidence' && method === 'GET') return json({ coverage: { score: 100 }, actions: [{ action: 'content_approved', result: 'success', reason: 'Human approval recorded' }] });
    if (path === '/events' && method === 'GET') return json([{ id: 'event-1', name: 'Leadership Course Event', eventDate: '2026-08-20T10:00:00.000Z' }]);
    if (path === '/postiz-channels/events/event-1/channels' && method === 'GET') return json({ selections: [], readiness: { state: 'ready' } });
    if (path === '/postiz/select-channel' && method === 'POST') return json({ status: 'selected', rawTokensReturned: false });
    if (path === '/postiz/package-payload' && method === 'POST') return json({ contentPreview: draft.draftText, target: { platform: 'instagram', proposedPublishAt: '2026-07-17T15:30:00.000Z' }, safety: { schedulingGate: { allowed: true, reasons: [] } } });
    if (path === '/postiz/package-sandbox-schedule' && method === 'POST') return json({ status: 'sandbox_scheduled', rawSecretsReturned: false });

    unexpected.push(`${method} ${path}${url.search}`);
    return json({ error: `Unexpected UX-R1D3 request: ${method} ${path}` }, 500);
  });

  return {
    seedApprovedPackage() {
      approvalStatus = 'approved';
      packages = [{ id: packageId, campaignId: campaign.id, contentItemId: draft.contentItemId, status: 'ready_for_future_execution', createdAt: '2026-07-10T11:00:00.000Z' }];
    },
    assertClean() {
      expect(unexpected, 'UX-R1D3 must not call unrelated APIs').toEqual([]);
      expect(failedResponses, 'UX-R1D3 must not receive failed API responses').toEqual([]);
      expect(browserProblems, 'UX-R1D3 must not emit console errors or warnings').toEqual([]);
    },
  };
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectUsableControls(page: Page) {
  const undersized = await page.locator('button:visible, input:visible, select:visible, textarea:visible, a.ops-button:visible').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return { label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName, width: Math.round(box.width), height: Math.round(box.height) };
  }).filter(control => control.width < 44 || control.height < 40));
  expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
}

async function capture(page: Page, name: string, fullPage = true) {
  if (process.env.UX_CAPTURE !== '1') return;
  await page.screenshot({ path: `docs/ux/ux-r1d3/${name}.png`, fullPage });
}

test.describe('UX-R1D3 production workflow', () => {
  test('marketing manager creates a real draft and submits it for review', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/ideas');
    await page.getByLabel('Objective').fill(campaign.objective);
    await page.getByLabel('Audience').fill(campaign.audience);
    await page.getByRole('button', { name: 'Generate Directions' }).click();
    await expect(page.getByRole('heading', { name: 'Choose A Direction' })).toBeVisible();
    await page.getByRole('button', { name: /Lead Before You Feel Ready/ }).click();
    await page.getByRole('button', { name: 'Select Direction' }).click();
    await page.getByRole('button', { name: 'Create Draft' }).click();
    await expect(page.locator('.content-draft-section').getByRole('heading', { name: campaign.topic })).toBeVisible();
    await page.getByRole('button', { name: 'Review Quality' }).click();
    await expect(page.getByText('86/100')).toBeVisible();
    await page.getByRole('button', { name: 'Send For Review' }).click();
    await expect(page.getByText('Sent for human review. Scheduling remains locked until an authorized approver decides.')).toBeVisible();
    await capture(page, 'production-content-desktop');
    await expectNoOverflow(page);
    await expectUsableControls(page);
    monitor.assertClean();
  });

  test('marketing manager can read Review but cannot make the final decision', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/review');
    await expect(page.getByRole('heading', { name: 'Review Content' })).toBeVisible();
    await page.getByRole('button', { name: /Leadership Course Launch/ }).click();
    await expect(page.getByText('Your role can read this decision context.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Approve Content' })).toHaveCount(0);
    await capture(page, 'production-review-mobile-readonly', false);
    await expectNoOverflow(page);
    monitor.assertClean();
  });

  test('CCO approves content and Tanaghum prepares the scheduling package', async ({ page }) => {
    const monitor = await installMocks(page, 'cco');
    await page.setViewportSize({ width: 1366, height: 950 });
    await page.goto('/review');
    await page.getByRole('button', { name: 'Approve Content' }).click();
    await expect(page.getByText('Content approved and prepared for scheduling.')).toBeVisible();
    await capture(page, 'production-review-desktop');
    await expectNoOverflow(page);
    monitor.assertClean();
  });

  test('approved content can complete the governed scheduling path', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    monitor.seedApprovedPackage();
    await page.setViewportSize({ width: 1366, height: 950 });
    await page.goto('/publishing');
    await expect(page.getByRole('heading', { name: 'Schedule Approved Content' })).toBeVisible();
    await expect(page.getByRole('heading', { name: campaign.topic })).toBeVisible();
    await page.getByRole('button', { name: 'Confirm Schedule' }).click();
    await expect(page.getByText('Schedule Recorded')).toBeVisible();
    await capture(page, 'production-scheduling-desktop');
    await expectNoOverflow(page);
    await expectUsableControls(page);
    monitor.assertClean();
  });

  test('mobile Scheduling uses queue to detail to back', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    monitor.seedApprovedPackage();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/publishing');
    await expect(page.getByRole('heading', { name: 'Approved Content', exact: true })).toBeVisible();
    await capture(page, 'production-scheduling-mobile-list', false);
    await page.getByRole('button', { name: /Leadership Course Launch/ }).click();
    await expect(page.getByRole('button', { name: 'Back To Approved Content' })).toBeVisible();
    await capture(page, 'production-scheduling-mobile-detail', false);
    await expectNoOverflow(page);
    await page.getByRole('button', { name: 'Back To Approved Content' }).click();
    await expect(page.getByRole('heading', { name: 'Approved Content', exact: true })).toBeVisible();
    monitor.assertClean();
  });

  test('empty Review and Scheduling return the user to the connected workflow', async ({ page }) => {
    const monitor = await installMocks(page, 'marketing_manager');
    await page.route('**/approvals', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
        return;
      }
      await route.fallback();
    });
    await page.route('**/publishing-package/list', async route => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });

    await page.goto('/review');
    await expect(page.getByRole('link', { name: 'Create Content' })).toHaveAttribute('href', '/ideas');
    await expect(page.getByRole('link', { name: 'Open Campaign Workspace' })).toHaveCount(0);

    await page.goto('/scheduling');
    await expect(page.getByRole('heading', { name: 'No Approved Content Yet' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Suggest A Time' })).toHaveCount(0);
    monitor.assertClean();
  });
});
