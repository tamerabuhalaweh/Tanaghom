import { expect, type Page, type TestInfo } from '@playwright/test';
import type { HybridLiveAccount } from '../fixtures/hybrid-live-accounts';

export const customerVisibleInternalTextPattern =
  /\b(Sprint\s*\d+|Acceptance\s+(Lead|Event|Truth)|acceptance workflow|smoke test|test tenant|raw values|Tenant-Owned Credentials|Mock LLM|Proof-led customer story|STITCH|SAIF|MCP|M5)\b/i;

const visibleUuidPattern =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;

export type AgentProfile = {
  id: string;
  name: string;
  objective: string;
  account: HybridLiveAccount;
};

type AgentObservation = {
  timestamp: string;
  action: string;
  path: string;
  detail: string;
};

type AgentEvidence = {
  agent: Omit<AgentProfile, 'account'> & { accountEmail: string };
  startedAt: string;
  completedAt?: string;
  visitedPaths: string[];
  observations: AgentObservation[];
  consoleErrors: string[];
  failedResponses: string[];
};

function safeAttachmentName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export class HybridRoleAgent {
  private readonly evidence: AgentEvidence;

  constructor(
    private readonly page: Page,
    private readonly testInfo: TestInfo,
    private readonly profile: AgentProfile,
  ) {
    this.evidence = {
      agent: {
        id: profile.id,
        name: profile.name,
        objective: profile.objective,
        accountEmail: profile.account.email,
      },
      startedAt: new Date().toISOString(),
      visitedPaths: [],
      observations: [],
      consoleErrors: [],
      failedResponses: [],
    };

    page.on('console', (message) => {
      if (message.type() === 'error') this.evidence.consoleErrors.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 400 && !response.url().includes('/favicon')) {
        this.evidence.failedResponses.push(
          `${response.status()} ${response.request().method()} ${response.url()}`,
        );
      }
    });
  }

  async login(): Promise<void> {
    await this.testInfo.attach(`${this.profile.id}-objective.txt`, {
      body: Buffer.from(this.profile.objective),
      contentType: 'text/plain',
    });
    await this.page.goto('/login', { waitUntil: 'domcontentloaded' });
    await this.page.getByRole('textbox', { name: 'Email' }).fill(this.profile.account.email);
    await this.page.getByRole('textbox', { name: 'Password' }).fill(this.profile.account.password);
    await this.page.getByRole('button', { name: /Open Command Center/i }).click();
    await this.page.waitForURL(/\/command-center(?:$|[?#])/, { timeout: 20000 });
    await expect(this.page.getByText(this.profile.account.expectedRole).first()).toBeVisible({
      timeout: 10000,
    });
    this.observe('login', 'Authenticated with the expected role.');
  }

  async visit(path: string, heading: string | RegExp): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    await expect(this.page.locator('main')).toBeVisible({ timeout: 15000 });
    await expect(this.page.getByRole('heading', { name: heading }).first()).toBeVisible({
      timeout: 15000,
    });
    await this.assertCustomerPageHealth(path);
    this.evidence.visitedPaths.push(path);
    this.observe('visit', `Opened ${path} and found the expected business workspace.`);
  }

  async expectRedirect(path: string, destination: RegExp): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded' });
    await this.page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => undefined);
    await expect(this.page).toHaveURL(destination);
    await this.assertCustomerPageHealth(path);
    this.evidence.visitedPaths.push(path);
    this.observe(
      'permission-check',
      `Access to ${path} redirected to an authorized customer workspace.`,
    );
  }

  async askStitchi(prompt: string): Promise<void> {
    const bubbles = this.page.locator('div.whitespace-pre-wrap.break-words');
    const before = await bubbles.count();
    await this.page
      .getByPlaceholder(/What should I focus|Ask Stitchi|Create/i)
      .first()
      .fill(prompt);
    const response = this.page.waitForResponse(
      (candidate) =>
        candidate.request().method() === 'POST' &&
        candidate.url().includes('/stitchi/') &&
        candidate.status() < 400,
      { timeout: 45000 },
    );
    await this.page.getByRole('button', { name: /^Ask Stitchi$/i }).click();
    await response;
    await expect.poll(() => bubbles.count(), { timeout: 45000 }).toBeGreaterThan(before + 1);
    this.observe(
      'stitchi-guidance',
      "Asked for today's next commercial action and received a non-executing response.",
    );
  }

  async expectVisible(name: string | RegExp): Promise<void> {
    await expect(this.page.getByText(name).first()).toBeVisible({ timeout: 10000 });
    this.observe('assertion', `Confirmed visible business context: ${String(name)}.`);
  }

  async expectNoNavigationLink(name: string | RegExp): Promise<void> {
    await expect(this.page.getByRole('link', { name })).toHaveCount(0);
    this.observe('permission-check', `Confirmed navigation does not expose ${String(name)}.`);
  }

  async capture(label: string): Promise<void> {
    const body = await this.page.screenshot({ fullPage: false });
    await this.testInfo.attach(`${this.profile.id}-${safeAttachmentName(label)}.png`, {
      body,
      contentType: 'image/png',
    });
  }

  async complete(): Promise<void> {
    this.evidence.completedAt = new Date().toISOString();
    await this.testInfo.attach(`${this.profile.id}-evidence.json`, {
      body: Buffer.from(JSON.stringify(this.evidence, null, 2)),
      contentType: 'application/json',
    });
    expect(
      this.evidence.failedResponses,
      `${this.profile.name} should have no failed page/API responses`,
    ).toEqual([]);
    expect(
      this.evidence.consoleErrors,
      `${this.profile.name} should have no browser console errors`,
    ).toEqual([]);
  }

  private observe(action: string, detail: string): void {
    this.evidence.observations.push({
      timestamp: new Date().toISOString(),
      action,
      path: new URL(this.page.url()).pathname,
      detail,
    });
  }

  private async assertCustomerPageHealth(label: string): Promise<void> {
    const main = this.page.locator('main');
    await expect(main).not.toContainText(customerVisibleInternalTextPattern);
    await expect(main).not.toContainText(visibleUuidPattern);
    const metrics = await this.page.evaluate(() => ({
      scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
      viewportWidth: window.innerWidth,
    }));
    expect(metrics.scrollWidth, `${label} should not horizontally overflow`).toBeLessThanOrEqual(
      metrics.viewportWidth + 2,
    );
  }
}
