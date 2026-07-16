import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { HybridRoleAgent, type AgentProfile } from './agentic/hybrid-role-agent';
import { hybridLiveAccounts } from './fixtures/hybrid-live-accounts';

const enabled = process.env.E2E_AGENTIC_HYBRID_LIVE === 'true';

test.describe('QA-A1 Hybrid multi-role customer acceptance', () => {
  test.describe.configure({ mode: 'serial' });
  test.skip(!enabled, 'Run npm run test:e2e:agentic-hybrid-live to test the deployed Hybrid.');

  test('Commercial Manager Agent follows the core daily journey and asks Stitchi for guidance', async ({
    page,
  }, testInfo) => {
    test.setTimeout(150000);
    const agent = createAgent(page, testInfo, {
      id: 'commercial-manager',
      name: 'Commercial Manager Agent',
      objective:
        "Understand today's priority, inspect plans and event execution, review lead work, then ask Stitchi what to do next without saving or calling an external system.",
      account: hybridLiveAccounts.manager,
    });
    await agent.login();
    await agent.visit('/command-center', /Today'?s Commercial Priorities/i);
    await agent.visit('/commercial-plans', /^Execution Plans$/i);
    await agent.visit('/events', /^Event Operations$/i);
    await agent.visit('/analytics', /^Sales & Leads$/i);
    await agent.visit('/stitchi', /Tell Stitchi what work you want done/i);
    await agent.askStitchi('What should I focus on today? Do not create or change any records.');
    await agent.capture('core-journey');
    await agent.complete();
  });

  test('Content Specialist Agent can prepare content but cannot enter privileged setup', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const agent = createAgent(page, testInfo, {
      id: 'content-specialist',
      name: 'Content Specialist Agent',
      objective:
        'Find the content workflow, confirm the next content action is clear, and prove that customer integration administration is not exposed.',
      account: hybridLiveAccounts.specialist,
    });
    await agent.login();
    await agent.visit('/ideas', /^Create Campaign Content$/i);
    await agent.expectVisible(/New Content/i);
    await agent.expectNoNavigationLink(/Integrations/i);
    await agent.expectNoNavigationLink(/Users & Roles/i);
    await agent.expectRedirect('/integration-credentials', /\/command-center(?:$|[?#])/);
    await agent.capture('content-permissions');
    await agent.complete();
  });

  test('CCO Agent can inspect review and executive decisions without changing records', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const agent = createAgent(page, testInfo, {
      id: 'cco-executive',
      name: 'CCO / Executive Agent',
      objective:
        'Inspect review work and executive commercial reporting, including honest missing-data and report-delivery readiness, without making a decision or changing a schedule.',
      account: hybridLiveAccounts.cco,
    });
    await agent.login();
    await agent.visit('/approvals', /^Review Content$/i);
    await agent.visit('/executive', /^Executive Dashboard$/i);
    await agent.expectVisible(/Executive report workflow/i);
    await agent.capture('executive-review');
    await agent.complete();
  });

  test('Sales Operations Agent can inspect the pipeline and CRM readiness without external writes', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const agent = createAgent(page, testInfo, {
      id: 'sales-operations',
      name: 'Sales Operations Agent',
      objective:
        'Review the lead pipeline, follow-up queue, customer journey, and CRM data readiness without recording an outcome or executing a CRM handoff.',
      account: hybridLiveAccounts.manager,
    });
    await agent.login();
    await agent.visit('/analytics', /^Sales & Leads$/i);
    await agent.expectVisible(/Lead pipeline/i);
    await agent.expectVisible(/Data readiness/i);
    await agent.capture('sales-pipeline');
    await agent.complete();
  });

  test('Admin and Security Agent can inspect privileged readiness without exposing secrets', async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    const agent = createAgent(page, testInfo, {
      id: 'admin-security',
      name: 'Admin / Security Agent',
      objective:
        'Inspect integration, operations, and account-security readiness while confirming secret values are not displayed and no setup is changed.',
      account: hybridLiveAccounts.admin,
    });
    await agent.login();
    await agent.visit('/integration-credentials', /^Connect Business Systems$/i);
    await agent.visit('/operations', /^Operations Readiness$/i);
    await agent.visit('/account-security', /^Account Security$/i);
    await agent.capture('admin-readiness');
    await agent.complete();
  });

  test('Exploratory Read-Only Agent sees a clean mobile workspace and cannot enter admin pages', async ({
    page,
  }, testInfo) => {
    test.setTimeout(90000);
    const agent = createAgent(page, testInfo, {
      id: 'exploratory-viewer',
      name: 'Exploratory Read-Only Agent',
      objective:
        'Navigate the mobile customer workspace as a restricted user, check discoverability and layout, and prove direct admin URLs are safely redirected.',
      account: hybridLiveAccounts.viewer,
    });
    await agent.login();
    await page.setViewportSize({ width: 390, height: 844 });
    await agent.visit('/command-center', /Today'?s Commercial Priorities/i);
    await expect(page.getByRole('navigation', { name: 'Mobile product navigation' })).toBeVisible();
    await agent.expectNoNavigationLink(/Integrations/i);
    await agent.expectNoNavigationLink(/Users & Roles/i);
    await agent.expectRedirect('/operations', /\/command-center(?:$|[?#])/);
    await agent.capture('mobile-restricted-workspace');
    await agent.complete();
  });
});

function createAgent(page: Page, testInfo: TestInfo, profile: AgentProfile): HybridRoleAgent {
  return new HybridRoleAgent(page, testInfo, profile);
}
