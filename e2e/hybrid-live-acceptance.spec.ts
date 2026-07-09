import { expect, test, type Page } from '@playwright/test';

const liveEnabled = process.env.E2E_HYBRID_LIVE === 'true' || process.env.E2E_ACCEPTANCE === 'true';

const accounts = {
  manager: {
    email: process.env.E2E_MANAGER_EMAIL || 'brand.head@tanaghum.com',
    password: process.env.E2E_MANAGER_PASSWORD || 'password123',
    expectedRole: /department head/i,
  },
  specialist: {
    email: process.env.E2E_SPECIALIST_EMAIL || 'demand.specialist@tanaghum.com',
    password: process.env.E2E_SPECIALIST_PASSWORD || 'password123',
    expectedRole: /specialist/i,
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@tanaghum.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'password123',
    expectedRole: /admin/i,
  },
} as const;

const customerPaths = [
  '/command-center',
  '/stitchi',
  '/ideas',
  '/campaigns',
  '/approvals',
  '/publishing',
  '/events',
  '/executive',
  '/integration-credentials',
] as const;

const customerVisibleInternalTextPattern =
  /\b(Sprint\s*\d+|Acceptance\s+(Lead|Event|Truth)|acceptance workflow|smoke test|test tenant|raw values|Tenant-Owned Credentials|STITCH|SAIF|MCP|M5)\b/i;

function installLiveMonitors(page: Page) {
  const consoleErrors: string[] = [];
  const failedResponses: string[] = [];

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  page.on('response', response => {
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

async function login(page: Page, account: typeof accounts[keyof typeof accounts]) {
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
  expect(metrics.scrollWidth, `${label} should not horizontally overflow`).toBeLessThanOrEqual(metrics.viewportWidth + 2);
}

async function assertCustomerPageHealth(page: Page, path: string) {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
  await expect(page.locator('main')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('main')).not.toContainText(customerVisibleInternalTextPattern);
  await expectNoHorizontalOverflow(page, path);
}

test.describe('Hybrid live customer acceptance', () => {
  test.skip(!liveEnabled, 'Set E2E_HYBRID_LIVE=true or run npm run test:e2e:hybrid-live to test deployed Hybrid.');

  test('manager, specialist, and admin can log in and load the customer workspace without console/API failures', async ({ page }) => {
    test.setTimeout(120000);
    const monitor = installLiveMonitors(page);

    for (const [role, account] of Object.entries(accounts)) {
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

  test('specialist is redirected away from admin-only connector setup while manager and admin can open it', async ({ page }) => {
    test.setTimeout(60000);
    const monitor = installLiveMonitors(page);

    await login(page, accounts.specialist);
    monitor.reset();
    await page.goto('/integration-credentials', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => undefined);
    await expect(page).toHaveURL(/\/events(?:$|[?#])/);
    monitor.assertClean('specialist connector redirect');

    for (const account of [accounts.manager, accounts.admin]) {
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

  test('Stitchi proposes an AI-assisted commercial plan without executing it before approval', async ({ page }) => {
    test.setTimeout(90000);
    const monitor = installLiveMonitors(page);
    await login(page, accounts.manager);

    monitor.reset();
    await page.goto('/stitchi', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: /Tell Stitchi what work you want done/i })).toBeVisible();

    await page.getByPlaceholder(/What should I focus|Ask Stitchi|Create/i).first().fill([
      'Stitchi, create an Online Courses plan for a leadership course launch.',
      'Objective: sell to entrepreneurs.',
      'Audience: warm followers and previous buyers.',
      'Budget target: 5000.',
      'Revenue target: 30000.',
      'Action plan: content, ads, GHL follow-up, WhatsApp reminders.',
      'Link it to the next available live event if suitable.',
    ].join('\n'));
    await page.getByRole('button', { name: /Ask Stitchi|Ask$/i }).last().click();

    await expect(page.getByText(/I prepared this for review/i)).toBeVisible({ timeout: 30000 });
    await expect(page.getByText(/No data has been changed yet/i).first()).toBeVisible();
    await expect(page.getByText(/gemma4-26b-a4b-canary/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /Approve|Save/i }).first()).toBeVisible();
    await expect(page.locator('main')).not.toContainText(customerVisibleInternalTextPattern);
    monitor.assertClean('Stitchi safe plan proposal');
  });
});
