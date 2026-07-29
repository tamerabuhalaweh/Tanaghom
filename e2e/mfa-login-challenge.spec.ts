import { expect, test, type Page } from '@playwright/test';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@customer.test',
  name: 'Customer Administrator',
  role: 'admin',
  tenantKey: 'default',
};

async function installMfaLogin(page: Page, validCode: string) {
  const requests: Array<Record<string, unknown>> = [];

  await page.route('**/auth/login', async route => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    requests.push(body);

    if (!body.mfaCode) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Authenticator code required',
          code: 'MFA_REQUIRED',
        }),
      });
      return;
    }

    if (body.mfaCode !== validCode) {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Invalid authenticator or recovery code',
          code: 'UNAUTHORIZED',
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mfa-authenticated-token',
        user,
        agentRep: null,
        mfaEnrollmentRequired: false,
      }),
    });
  });

  return requests;
}

async function submitPassword(page: Page) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(user.email);
  await page.locator('#password').fill('controlled-password');
  await page.getByRole('button', { name: 'Open Command Center' }).click();
}

test.describe('MFA login challenge', () => {
  test('reveals and focuses the authenticator field before completing sign-in', async ({ page }) => {
    const requests = await installMfaLogin(page, '123456');
    await submitPassword(page);

    const codeInput = page.getByRole('textbox', { name: 'Authenticator or recovery code' });
    await expect(page.getByText('Verify it is you')).toBeVisible();
    await expect(codeInput).toBeVisible();
    await expect(codeInput).toBeFocused();
    await expect(page.getByRole('button', { name: 'Verify and Sign In' })).toBeVisible();

    await codeInput.fill('123456');
    await page.getByRole('button', { name: 'Verify and Sign In' }).click();

    await expect.poll(() => requests.length).toBe(2);
    expect(requests[0]).not.toHaveProperty('mfaCode');
    expect(requests[1]).toMatchObject({ mfaCode: '123456' });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBe('mfa-authenticated-token');
  });

  test('accepts a formatted one-time recovery code', async ({ page }) => {
    const requests = await installMfaLogin(page, 'AB12-CD34-EF56');
    await submitPassword(page);

    const codeInput = page.getByRole('textbox', { name: 'Authenticator or recovery code' });
    await codeInput.fill('ab12-cd34-ef56');
    await page.getByRole('button', { name: 'Verify and Sign In' }).click();

    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1]).toMatchObject({ mfaCode: 'AB12-CD34-EF56' });
    await expect.poll(() => page.evaluate(() => localStorage.getItem('token'))).toBe('mfa-authenticated-token');
  });
});
