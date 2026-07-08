import { expect, test } from '@playwright/test';

const guardEnabled =
  process.env.E2E_PRODUCTION_TEXT_GUARD === 'true' ||
  process.env.E2E_ACCEPTANCE === 'true';

const email = process.env.E2E_USER_EMAIL || 'admin@tanaghum.com';
const password = process.env.E2E_USER_PASSWORD || 'password123';

const customerPaths = [
  '/command-center',
  '/events',
  '/ideas',
  '/approvals',
  '/publishing',
  '/analytics',
  '/integration-credentials',
];

const internalLanguagePattern =
  /\b(Sprint\s*\d+|Acceptance\s+(Lead|Event|Truth)|acceptance workflow|smoke test|test tenant|raw values|Tenant-Owned Credentials|STITCH|SAIF|MCP|M5)\b/i;

test.describe('customer production language guard', () => {
  test.skip(!guardEnabled, 'Set E2E_PRODUCTION_TEXT_GUARD=true or E2E_ACCEPTANCE=true to scan deployed customer pages.');

  test('customer workflow pages do not expose sprint/test/internal language', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(email);
    await page.getByRole('textbox', { name: 'Password' }).fill(password);
    await page.getByRole('button', { name: 'Open Command Center' }).click();
    await page.waitForURL(/\/(command-center|dashboard)(?:$|[?#])/, { timeout: 20000 });

    for (const path of customerPaths) {
      await page.goto(path);
      const main = page.locator('main');
      await expect(main).toBeVisible({ timeout: 20000 });
      const body = await main.innerText();
      expect(body, `${path} must use production customer language`).not.toMatch(internalLanguagePattern);
    }
  });
});
