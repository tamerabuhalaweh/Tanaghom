import { expect, test, type Page } from '@playwright/test';

const routes = [
  { path: '/ux/r1d3/content', heading: 'Create campaign content' },
  { path: '/ux/r1d3/review', heading: 'Review content' },
  { path: '/ux/r1d3/scheduling', heading: 'Schedule approved content' },
];

async function monitorReference(page: Page) {
  const browserProblems: string[] = [];
  const apiRequests: string[] = [];
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') browserProblems.push(`${message.type()}: ${message.text()}`);
  });
  page.on('pageerror', error => browserProblems.push(`pageerror: ${error.message}`));
  page.on('request', request => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/api/') || url.port === '4000') apiRequests.push(`${request.method()} ${request.url()}`);
  });
  return {
    assertClean() {
      expect(browserProblems, 'Reference pages must not emit browser errors or warnings').toEqual([]);
      expect(apiRequests, 'Static reference pages must not call Tanaghum APIs').toEqual([]);
    },
  };
}

async function expectNoOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
}

async function expectUsableControls(page: Page) {
  const undersized = await page.locator('button:visible, input:visible, select:visible, textarea:visible, a.r1d3-button:visible').evaluateAll(elements => elements.map(element => {
    const box = element.getBoundingClientRect();
    return {
      label: element.getAttribute('aria-label') || element.textContent?.trim() || element.tagName,
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }).filter(control => control.width < 44 || control.height < 44));
  expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
}

async function expectCustomerLanguage(page: Page) {
  await expect(page.getByText(/Sprint \d+|Acceptance Event|MCP|M5|SAIF|payload|integration ID|sandbox execution|evidence coverage/i)).toHaveCount(0);
}

async function capture(page: Page, name: string, fullPage = true) {
  if (process.env.UX_CAPTURE !== '1') return;
  await page.screenshot({ path: `docs/ux/ux-r1d3/${name}.png`, fullPage });
}

test.describe('UX-R1D3 connected content lifecycle reference', () => {
  test('content reference supports brief, directions, draft, and review handoff', async ({ page }) => {
    const monitor = await monitorReference(page);
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto('/ux/r1d3/content');
    await expect(page.getByRole('heading', { name: 'Create campaign content' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Prepare the draft' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recent content' })).toBeVisible();
    await capture(page, 'reference-content-desktop');

    await page.getByRole('button', { name: 'New content' }).click();
    await expect(page.getByRole('heading', { name: 'Campaign brief' })).toBeVisible();
    await page.getByRole('button', { name: 'Generate directions' }).click();
    await expect(page.getByRole('heading', { name: 'Choose a direction' })).toBeVisible();
    await page.getByRole('button', { name: /The cost of waiting for certainty/ }).click();
    await page.getByRole('button', { name: 'Use selected direction' }).click();
    await expect(page.getByRole('heading', { name: 'Prepare the draft' })).toBeVisible();
    await expectNoOverflow(page);
    await expectUsableControls(page);
    await expectCustomerLanguage(page);
    monitor.assertClean();
  });

  test('review reference uses bounded queue and selected decision context', async ({ page }) => {
    const monitor = await monitorReference(page);
    await page.setViewportSize({ width: 1366, height: 950 });
    await page.goto('/ux/r1d3/review');
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Leadership begins before confidence arrives' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Approve content' })).toBeVisible();
    await capture(page, 'reference-review-desktop');
    await expectNoOverflow(page);
    await expectUsableControls(page);
    await expectCustomerLanguage(page);
    monitor.assertClean();
  });

  test('scheduling reference keeps the customer task ahead of setup mechanics', async ({ page }) => {
    const monitor = await monitorReference(page);
    await page.setViewportSize({ width: 1366, height: 950 });
    await page.goto('/ux/r1d3/scheduling');
    await expect(page.getByRole('heading', { name: 'Approved content', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Leadership begins before confidence arrives' })).toBeVisible();
    await expect(page.getByLabel('Social account')).toHaveValue('instagram-business');
    await capture(page, 'reference-scheduling-desktop');
    await page.getByRole('button', { name: 'Confirm schedule' }).click();
    await expect(page.getByText('Schedule recorded')).toBeVisible();
    await expectNoOverflow(page);
    await expectUsableControls(page);
    await expectCustomerLanguage(page);
    monitor.assertClean();
  });

  test('mobile content, review, and scheduling remain task focused', async ({ page }) => {
    const monitor = await monitorReference(page);
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto('/ux/r1d3/content');
    await expect(page.getByRole('heading', { name: 'Prepare the draft' })).toBeVisible();
    await capture(page, 'reference-content-mobile', false);
    await expectNoOverflow(page);
    await expectUsableControls(page);

    await page.goto('/ux/r1d3/review');
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();
    await capture(page, 'reference-review-mobile-list', false);
    await page.getByRole('button', { name: /Leadership begins before confidence arrives/ }).click();
    await expect(page.getByRole('button', { name: 'Back to review queue' })).toBeVisible();
    await capture(page, 'reference-review-mobile-detail', false);
    await page.getByRole('button', { name: 'Back to review queue' }).click();
    await expect(page.getByRole('heading', { name: 'Review queue' })).toBeVisible();

    await page.goto('/ux/r1d3/scheduling');
    await expect(page.getByRole('heading', { name: 'Approved content', exact: true })).toBeVisible();
    await capture(page, 'reference-scheduling-mobile-list', false);
    await page.getByRole('button', { name: /Leadership begins before confidence arrives/ }).click();
    await expect(page.getByRole('button', { name: 'Back to approved content' })).toBeVisible();
    await capture(page, 'reference-scheduling-mobile-detail', false);
    await expectNoOverflow(page);
    await expectUsableControls(page);
    await expectCustomerLanguage(page);
    monitor.assertClean();
  });

  test('all reference routes pass the responsive width matrix', async ({ page }) => {
    const monitor = await monitorReference(page);
    for (const width of [390, 768, 1024, 1366, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      for (const route of routes) {
        await page.goto(route.path);
        await expect(page.getByRole('heading', { name: route.heading })).toBeVisible();
        await expectNoOverflow(page);
        await expectCustomerLanguage(page);
      }
    }
    monitor.assertClean();
  });
});
