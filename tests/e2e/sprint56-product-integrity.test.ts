import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(...segments: string[]): string {
  return readFileSync(resolve(process.cwd(), ...segments), 'utf8');
}

describe('Sprint 56 production product integrity contracts', () => {
  it('keeps frontend API clients wired to registered backend route prefixes', () => {
    const backend = source('src', 'index.ts');
    const api = source('frontend', 'src', 'api.ts');

    const contracts = [
      '/admin/tenant',
      '/commercial-workflow',
      '/postiz',
      '/ai-provider',
      '/integration-credentials',
      '/social-oauth',
      '/runtime-bridges',
      '/mcp-runtime',
      '/ops',
      '/smartlabs',
      '/ghl',
      '/leads',
    ];

    for (const prefix of contracts) {
      expect(api, `${prefix} must be consumed by frontend API client`).toContain(`'${prefix}`);
      expect(backend, `${prefix} must be registered in Express`).toContain(`app.use('${prefix}'`);
    }
  });

  it('keeps product navigation aligned with implemented customer and admin routes', () => {
    const app = source('frontend', 'src', 'App.tsx');
    const layout = source('frontend', 'src', 'components', 'Layout.tsx');

    const navigationContracts = [
      { path: '/command-center', route: 'command-center', label: 'Dashboard' },
      { path: '/campaigns', route: 'campaigns', label: 'Campaigns' },
      { path: '/ideas', route: 'ideas', label: 'Content Creator' },
      { path: '/approvals', route: 'approvals', label: 'Review & Approve' },
      { path: '/publishing', route: 'publishing', label: 'Scheduling' },
      { path: '/analytics', route: 'analytics', label: 'Performance' },
      { path: '/my-agent-rep', route: 'my-agent-rep', label: 'My Profile' },
      { path: '/account-security', route: 'account-security', label: 'Account Security' },
      { path: '/ai-settings', route: 'ai-settings', label: 'AI Settings' },
      { path: '/admin-users', route: 'admin-users', label: 'Users & Roles' },
      { path: '/tenant-admin', route: 'tenant-admin', label: 'Tenant Admin' },
      { path: '/agent-skills', route: 'agent-skills', label: 'Agent Skills' },
      { path: '/operations', route: 'operations', label: 'Operations' },
      { path: '/smartlabs-voice', route: 'smartlabs-voice', label: 'SmartLabs Voice' },
      { path: '/mcp-engine', route: 'mcp-engine', label: 'Integrations' },
      { path: '/integration-credentials', route: 'integration-credentials', label: 'Credentials' },
      { path: '/safety', route: 'safety', label: 'Security' },
      { path: '/observability', route: 'observability', label: 'Activity Log' },
    ];

    for (const item of navigationContracts) {
      expect(layout, `${item.label} nav path must exist`).toContain(`path: '${item.path}'`);
      expect(layout, `${item.label} nav label must exist`).toContain(`label: '${item.label}'`);
      expect(app, `${item.path} route must exist`).toContain(`path="${item.route}"`);
    }

    for (const alias of ['dashboard', 'content', 'review', 'scheduling', 'performance']) {
      expect(app, `${alias} friendly alias must exist`).toContain(`path="${alias}"`);
    }

    for (const staleCustomerLabel of ['AI Draft Studio', 'My AI Rep', 'Approvals & Publishing', 'Campaigns Briefs']) {
      expect(layout, `${staleCustomerLabel} must not remain in primary navigation`).not.toContain(staleCustomerLabel);
    }
  });

  it('keeps Tenant Admin subscription, export, and deletion controls connected to API clients', () => {
    const api = source('frontend', 'src', 'api.ts');
    const tenantAdmin = source('frontend', 'src', 'pages', 'TenantAdmin.tsx');

    for (const clientFunction of ['plans', 'subscription', 'updateSubscription', 'exportData', 'deletionReadiness', 'requestDeletion']) {
      expect(api, `${clientFunction} must be exposed by tenantAdminApi`).toContain(`${clientFunction}:`);
      expect(tenantAdmin, `${clientFunction} must be consumed by TenantAdmin UI`).toContain(`tenantAdminApi.${clientFunction}`);
    }

    for (const requiredUiText of [
      'Subscription & Entitlements',
      'Tenant Export',
      'Deletion Readiness',
      'Deletion Review Request',
      'Request Offline Purge Review',
      'Raw secrets, API keys, password hashes, and tokens were redacted.',
    ]) {
      expect(tenantAdmin).toContain(requiredUiText);
    }
  });

  it('keeps the Command Center dependent on real backend state instead of static readiness panels', () => {
    const commandCenter = source('frontend', 'src', 'pages', 'DemoCommandCenter.tsx');

    for (const runtimeApi of [
      'campaignsApi.list',
      'aiProviderApi.status',
      'commercialWorkflowApi.state',
      'postizApi.status',
      'postizApi.channels',
      'approvalsApi.list',
      'publishingPackageApi.list',
      'leadsApi.list',
      'leadsApi.stats',
      'analyticsApi.sources',
      'analyticsApi.snapshots',
      'analyticsApi.reports',
      'integrationStatusApi.get',
    ]) {
      expect(commandCenter, `${runtimeApi} must feed Dashboard state`).toContain(runtimeApi);
    }

    for (const customerFacingSection of [
      'Quick Setup',
      'Your Content Workflow',
      'Content Journey',
      'Performance & Results',
      'Generate Content',
      'Review Content Quality',
      'Send for Review',
      'Prepare for Scheduling',
    ]) {
      expect(commandCenter).toContain(customerFacingSection);
    }

    for (const forbiddenStaticCue of ['External Execution Blocked', 'M5 Disabled']) {
      expect(commandCenter, `${forbiddenStaticCue} should not dominate customer-facing Dashboard copy`).not.toContain(forbiddenStaticCue);
    }
  });
});
