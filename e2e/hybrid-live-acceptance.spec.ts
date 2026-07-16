import { expect, test, type Page } from '@playwright/test';
import {
  hybridLiveAccounts,
  hybridLiveEnabled,
  type HybridLiveAccount,
} from './fixtures/hybrid-live-accounts';

const customerPaths = [
  '/command-center',
  '/ideas',
  '/campaigns',
  '/approvals',
  '/publishing',
  '/events',
  '/analytics',
  '/executive',
  '/integration-credentials',
] as const;

const customerVisibleInternalTextPattern =
  /\b(Sprint\s*\d+|Acceptance\s+(Lead|Event|Truth)|acceptance workflow|smoke test|test tenant|raw values|Tenant-Owned Credentials|Mock LLM|Proof-led customer story|STITCH|SAIF|MCP|M5)\b/i;

function installLiveMonitors(page: Page) {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  page.on('response', (response) => {
    const status = response.status();
    const url = response.url();
    if (status >= 400 && !url.includes('/favicon')) {
      failedResponses.push(`${status} ${url}`);
    }
  });

  return {
    reset() {
      consoleErrors.length = 0;
      failedResponses.length = 0;
    },
    assertClean(label: string) {
      expect(failedResponses, `${label} should not have failed API/page responses`).toEqual([]);
      expect(consoleErrors, `${label} should not log browser console errors`).toEqual([]);
    },
  };
}

async function login(page: Page, account: HybridLiveAccount) {
  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.getByRole('textbox', { name: 'Email' }).fill(account.email);
  await page.getByRole('textbox', { name: 'Password' }).fill(account.password);
  await page.getByRole('button', { name: /Open Command Center/i }).click();
  await page.waitForURL(/\/command-center(?:$|[?#])/, { timeout: 20000 });
  await expect(page.getByText(account.expectedRole).first()).toBeVisible({ timeout: 10000 });
}

async function expectNoHorizontalOverflow(page: Page, label: string) {
  const metrics = await page.evaluate(() => {
    const scrollWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    return { scrollWidth, viewportWidth: window.innerWidth };
  });
  expect(metrics.scrollWidth, `${label} should not horizontally overflow`).toBeLessThanOrEqual(
    metrics.viewportWidth + 2,
  );
}

async function assertCustomerPageHealth(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('main')).not.toContainText(customerVisibleInternalTextPattern);
  await expectNoHorizontalOverflow(page, path);
}

async function respectLiveRateLimitIfTriggered(
  page: Page,
  monitor: ReturnType<typeof installLiveMonitors>,
) {
  const rateLimitMessage = page.getByText(/Rate limit exceeded/i).first();
  if (await rateLimitMessage.isVisible().catch(() => false)) {
    await page.waitForTimeout(61000);
    monitor.reset();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  }
}

test.describe('Hybrid live customer acceptance', () => {
  test.skip(
    !hybridLiveEnabled,
    'Set E2E_HYBRID_LIVE=true or run npm run test:e2e:hybrid-live to test deployed Hybrid.',
  );

  test('Stitchi proposes an AI-assisted commercial plan without executing it before approval', async ({
    page,
  }) => {
    test.setTimeout(90000);
    const monitor = installLiveMonitors(page);
    await login(page, hybridLiveAccounts.manager);

    monitor.reset();
    await page.goto('/stitchi', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: /Tell Stitchi what work you want done/i }),
    ).toBeVisible();

    await page
      .getByPlaceholder(/What should I focus|Ask Stitchi|Create/i)
      .first()
      .fill(
        [
          'Stitchi, create an Online Courses plan for a leadership course launch.',
          'Create it as a standalone exception because this urgent partner launch was approved outside the normal annual planning cycle.',
          'Objective: sell to entrepreneurs.',
          'Audience: warm followers and previous buyers.',
          'Budget target: 5000.',
          'Revenue target: 30000.',
          'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
          'Link it to the next available live event if suitable.',
        ].join('\n'),
      );
    await page
      .getByRole('button', { name: /Ask Stitchi|Ask$/i })
      .last()
      .click();

    await expect(page.getByText(/I prepared this for review/i).first()).toBeVisible({
      timeout: 30000,
    });
    await expect(page.getByText(/No data has been changed yet/i).first()).toBeVisible();
    await expect(page.getByText(/^AI assisted$/i).last()).toBeVisible();
    await expect(
      page.getByText(/plan details were enriched by your connected AI model/i).last(),
    ).toBeVisible();
    await expect(page.getByText(/^Content pillars$/i).last()).toBeVisible();
    await expect(page.getByText(/^Channel plan$/i).last()).toBeVisible();
    await expect(page.getByText(/Admin or CCO approval required/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Approve|Save/i })).toHaveCount(0);
    await expect(page.locator('main')).not.toContainText(customerVisibleInternalTextPattern);
    monitor.assertClean('Stitchi safe plan proposal');
  });

  test('manager, specialist, and admin can log in and load the customer workspace without console/API failures', async ({
    page,
  }) => {
    test.setTimeout(120000);
    const monitor = installLiveMonitors(page);

    const originalAcceptanceAccounts = {
      manager: hybridLiveAccounts.manager,
      specialist: hybridLiveAccounts.specialist,
      admin: hybridLiveAccounts.admin,
    };
    for (const [role, account] of Object.entries(originalAcceptanceAccounts)) {
      monitor.reset();
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear()).catch(() => undefined);

      await login(page, account);
      monitor.assertClean(`${role} login`);

      for (const path of customerPaths) {
        monitor.reset();
        await assertCustomerPageHealth(page, path);
        monitor.assertClean(`${role} ${path}`);
      }
    }
  });

  test('specialist is redirected away from admin-only connector setup while manager and admin can open it', async ({
    page,
  }) => {
    test.setTimeout(60000);
    const monitor = installLiveMonitors(page);

    await login(page, hybridLiveAccounts.specialist);
    monitor.reset();
    await page.goto('/integration-credentials', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
    await expect(page).toHaveURL(/\/command-center(?:$|[?#])/);
    monitor.assertClean('specialist connector redirect');

    for (const account of [hybridLiveAccounts.manager, hybridLiveAccounts.admin]) {
      await page.context().clearCookies();
      await page.evaluate(() => localStorage.clear()).catch(() => undefined);
      await login(page, account);
      monitor.reset();
      await page.goto('/integration-credentials', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/integration-credentials(?:$|[?#])/);
      await expect(page.getByRole('heading', { name: /Connect Business Systems/i })).toBeVisible();
      monitor.assertClean(`${account.email} connector setup`);
    }
  });

  test('manager can operate Event Operations and Sales & Leads at desktop and mobile widths', async ({
    page,
  }) => {
    test.setTimeout(90000);
    const monitor = installLiveMonitors(page);

    await page.setViewportSize({ width: 1440, height: 1000 });
    await login(page, hybridLiveAccounts.manager);

    monitor.reset();
    await page.goto('/events', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
    await expect(page.getByRole('heading', { name: /^Event Operations$/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('navigation', { name: 'Event workspace views' })).toBeVisible();
    await expectNoHorizontalOverflow(page, 'desktop event operations');
    monitor.assertClean('desktop event operations');

    monitor.reset();
    await page.goto('/analytics', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
    await expect(page.getByRole('heading', { name: /^Sales & Leads$/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByRole('button', { name: /^Lead Pipeline$/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, 'desktop sales and leads');
    monitor.assertClean('desktop sales and leads');

    await page.setViewportSize({ width: 390, height: 844 });
    monitor.reset();
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
    await expect(page.getByRole('heading', { name: /^Sales & Leads$/i })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile product navigation' })).toBeVisible();
    await expectNoHorizontalOverflow(page, 'mobile sales and leads');
    monitor.assertClean('mobile sales and leads');

    monitor.reset();
    await page.goto('/events', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
    await expect(page.getByRole('heading', { name: /^Event Operations$/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, 'mobile event operations');
    monitor.assertClean('mobile event operations');
  });

  test('admin can configure the daily executive report workflow with honest delivery readiness', async ({
    page,
  }) => {
    test.setTimeout(160000);
    const monitor = installLiveMonitors(page);

    // The earlier live acceptance sweep intentionally opens many pages quickly.
    // Start this admin write-flow in a fresh production rate-limit window.
    await page.waitForTimeout(61000);

    await login(page, hybridLiveAccounts.admin);
    monitor.reset();
    await page.goto('/executive', { waitUntil: 'domcontentloaded' });
    await respectLiveRateLimitIfTriggered(page, monitor);
    await expect(page.getByRole('heading', { name: /^Executive Dashboard$/i })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText(/Executive report workflow/i).first()).toBeVisible();

    const recipients = page.getByRole('textbox', { name: /Additional recipients/i });
    await recipients.fill(`gm-${Date.now()}@tanaghum.test`);
    await page.getByRole('button', { name: /Save schedule/i }).click();

    await expect(page.getByText(/Executive report workflow saved/i).first()).toBeVisible({
      timeout: 20000,
    });
    await expect(page.getByText(/09:00/i).first()).toBeVisible();
    await expect(page.getByText(/Email/i).first()).toBeVisible();
    await expect(page.getByText(/WhatsApp/i).first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(customerVisibleInternalTextPattern);
    await expectNoHorizontalOverflow(page, 'executive report workflow');
    monitor.assertClean('executive report workflow setup');
  });
});
