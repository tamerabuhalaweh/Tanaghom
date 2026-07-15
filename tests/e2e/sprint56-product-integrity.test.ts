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
      '/social-growth',
      '/events',
      '/annual-commercial-plans',
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
      { path: '/command-center', route: 'command-center', label: 'Today' },
      { path: '/commercial-planning', route: 'commercial-planning', label: 'Plans' },
      { path: '/events', route: 'events', label: 'Event Operations' },
      { path: '/ideas', route: 'ideas', label: 'Content' },
      { path: '/approvals', route: 'approvals', label: 'Review Queue' },
      { path: '/publishing', route: 'publishing', label: 'Scheduling' },
      { path: '/analytics', route: 'analytics', label: 'Sales & Leads' },
      { path: '/growth', route: 'growth', label: 'Performance' },
      { path: '/stitchi', route: 'stitchi', label: 'Stitchi' },
      { path: '/my-agent-rep', route: 'my-agent-rep', label: 'My Profile' },
      { path: '/account-security', route: 'account-security', label: 'Account Security' },
      { path: '/ai-settings', route: 'ai-settings', label: 'AI Model' },
      { path: '/admin-users', route: 'admin-users', label: 'Users & Roles' },
      { path: '/tenant-admin', route: 'tenant-admin', label: 'Workspace Admin' },
      { path: '/operations', route: 'operations', label: 'Operations' },
      { path: '/integration-credentials', route: 'integration-credentials', label: 'Integrations' },
      { path: '/observability', route: 'observability', label: 'Activity Log' },
    ];

    for (const item of navigationContracts) {
      expect(layout, `${item.label} nav path must exist`).toContain(`path: '${item.path}'`);
      expect(layout, `${item.label} nav label must exist`).toContain(`label: '${item.label}'`);
      expect(app, `${item.path} route must exist`).toContain(`path="${item.route}"`);
    }

    expect(app, 'Campaign Workspace route must remain available for direct and legacy links').toContain('path="campaigns"');
    expect(app, 'Detailed commercial execution plans must remain available below annual planning').toContain('path="commercial-plans"');
    expect(layout, 'Campaign Workspace must not compete with the connected Content journey').not.toContain("path: '/campaigns'");

    for (const hiddenTechnicalRoute of ['agent-skills', 'runtime-infrastructure', 'smartlabs-voice', 'mcp-engine', 'safety']) {
      expect(app, `${hiddenTechnicalRoute} route must remain available behind route permissions`).toContain(`path="${hiddenTechnicalRoute}"`);
      expect(layout, `${hiddenTechnicalRoute} must not compete with daily customer navigation`).not.toContain(`path: '/${hiddenTechnicalRoute}'`);
    }

    for (const alias of ['dashboard', 'content', 'review', 'scheduling', 'performance']) {
      expect(app, `${alias} friendly alias must exist`).toContain(`path="${alias}"`);
    }

    for (const staleCustomerLabel of ['AI Draft Studio', 'My AI Rep', 'Approvals & Publishing', 'Campaigns Briefs']) {
      expect(layout, `${staleCustomerLabel} must not remain in primary navigation`).not.toContain(staleCustomerLabel);
    }
  });

  it('keeps runtime infrastructure evidence separated from customer integrations', () => {
    const app = source('frontend', 'src', 'App.tsx');
    const layout = source('frontend', 'src', 'components', 'Layout.tsx');
    const integrationCredentials = source('frontend', 'src', 'pages', 'IntegrationCredentials.tsx');
    const runtimeInfrastructure = source('frontend', 'src', 'pages', 'RuntimeInfrastructure.tsx');
    const runtimeController = source('modules', 'runtime-bridges', 'controller.ts');

    expect(app).toContain('path="runtime-infrastructure"');
    expect(app).toContain('adminOnly(<RuntimeInfrastructure />)');
    expect(layout).not.toContain("label: 'Runtime Evidence'");
    expect(layout).not.toContain("path: '/runtime-infrastructure'");
    expect(layout).toContain("label: 'Activity Log'");
    expect(integrationCredentials).not.toContain('runtimeBridgesApi');
    expect(integrationCredentials).not.toContain('OpenClaw Runtime');
    expect(runtimeInfrastructure).toContain('OpenClaw');
    expect(runtimeInfrastructure).toContain('agentgateway');
    expect(runtimeInfrastructure).toContain('AgentScope');
    expect(runtimeInfrastructure).toContain('Not Production Active');
    expect(runtimeController).toContain('requireRuntimeOpsRole(payload.role)');
    expect(runtimeController).toContain('productionActive');
    expect(runtimeController).toContain('customerFacing: false');
  });

  it('keeps non-admin event workspaces from calling forbidden problem dashboard APIs', () => {
    const hybridWorkspace = source('frontend', 'src', 'pages', 'HybridEventWorkspace.tsx');

    expect(hybridWorkspace).toContain('canLoadProblemDashboard(role)');
    expect(hybridWorkspace).toContain('localProblemDashboard(normalizedProblems)');
    expect(hybridWorkspace).toContain("limitedByRole: true");
    expect(hybridWorkspace).toContain("eventProblemsApi.dashboard(nextEventId, token).catch(() => null)");
    expect(hybridWorkspace).not.toContain("eventProblemsApi.dashboard(nextEventId, token).catch(() => ({}))");
  });

  it('keeps agentgateway as the selected low-risk runtime pilot for connector dry-runs', () => {
    const connectorService = source('modules', 'connector-imports', 'service.ts');
    const agentgateway = source('modules', 'runtime-bridges', 'agentgateway.ts');
    const runtimeController = source('modules', 'runtime-bridges', 'controller.ts');
    const backend = source('src', 'index.ts');

    expect(connectorService).toContain('mediateConnectorDryRunPolicy');
    expect(connectorService).toContain('runtimeMediation');
    expect(agentgateway).toContain('AGENTGATEWAY_DRY_RUN_POLICY_ENABLED');
    expect(agentgateway).toContain("operation: 'connector_import.dry_run'");
    expect(agentgateway).toContain('externalWritesAllowed: false');
    expect(agentgateway).toContain('rawSecretsReturned: false');
    expect(runtimeController).toContain('AGENTGATEWAY_DRY_RUN_POLICY_ENABLED');
    expect(runtimeController).toContain("'/agentgateway/sandbox-policy/connector-dry-run'");
    expect(runtimeController).toContain('AGENTGATEWAY_SANDBOX_POLICY_TOKEN');
    expect(runtimeController).toContain('productionGateway: false');
    expect(backend).toContain("req.path.startsWith('/runtime-bridges/agentgateway/sandbox-policy/')");
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
      'socialGrowthApi.summary',
    ]) {
      expect(commandCenter, `${runtimeApi} must feed Dashboard state`).toContain(runtimeApi);
    }

    for (const customerFacingSection of [
      'Quick Setup',
      'Your Content Workflow',
      'Content Journey',
      'Performance & Results',
      'Social Growth Control Room',
      'Growth Engine Next Actions',
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

  it('keeps Campaigns as a guided customer workflow instead of a scattered workspace', () => {
    const campaigns = source('frontend', 'src', 'pages', 'CampaignWorkspace.tsx');

    for (const requiredCustomerCue of [
      "Today's campaign step",
      'Create a Course-Sales Campaign',
      'Workflow Guide',
      'What happens next',
      'Search campaigns',
      'Only the current step opens in detail',
      'Live Scheduling Controlled',
    ]) {
      expect(campaigns).toContain(requiredCustomerCue);
    }

    for (const oldScatteredCue of [
      'What this workspace does',
      'Course Sales Starters',
      'Postiz payload preview',
    ]) {
      expect(campaigns, `${oldScatteredCue} should not remain in the customer-facing Campaigns copy`).not.toContain(oldScatteredCue);
    }
  });

  it('keeps Sprint 58 customer content and lead handoff aligned to the course-sales product', () => {
    const aiGeneration = source('modules', 'ai-generation', 'service.ts');
    const llmProvider = source('shared', 'providers', 'llm-provider.ts');
    const leadsController = source('modules', 'leads', 'controller.ts');
    const analytics = source('frontend', 'src', 'pages', 'Analytics.tsx');

    for (const expectedCue of [
      'course and life-coaching creator brand',
      'turn followers into qualified course leads',
      'course-sales conversion intent',
      'fake engagement',
    ]) {
      expect(aiGeneration).toContain(expectedCue);
    }

    for (const staleCue of ['health-tech company', 'General health-conscious audience', '#HealthTech', '#Wellness']) {
      expect(aiGeneration, `${staleCue} must not remain in draft generation`).not.toContain(staleCue);
    }

    expect(llmProvider).toContain('Fallback Content Provider');
    expect(llmProvider).toContain('fallback-course-social-v1');
    expect(llmProvider).not.toContain('[Mock LLM] Generated content');

    for (const leadField of ['leadName', 'leadEmail', 'leadPhone']) {
      expect(leadsController, `${leadField} must be returned to the tenant UI`).toContain(leadField);
      expect(analytics, `${leadField} must be displayed in Sales & Leads`).toContain(leadField);
    }

    expect(analytics).toContain('smartLabsApi.leadHandoffPreview');
    expect(analytics).toContain('Voice/chat handoff');
    expect(analytics).toContain('Voice/chat handoff preview prepared. No external call was made.');
  });

  it('keeps Sprint 60 Events dashboard wired to event APIs and customer-facing navigation', () => {
    const api = source('frontend', 'src', 'api.ts');
    const app = source('frontend', 'src', 'App.tsx');
    const layout = source('frontend', 'src', 'components', 'Layout.tsx');
    const eventDashboard = source('frontend', 'src', 'pages', 'EventDashboard.tsx');
    const controller = source('modules', 'commercial-events', 'controller.ts');

    for (const apiFunction of ['list', 'create', 'update', 'transition', 'dashboard', 'campaigns', 'leads', 'createKpi', 'updateKpi']) {
      expect(api, `eventsApi.${apiFunction} must be exposed`).toContain(`${apiFunction}:`);
    }

    for (const backendPath of ['/:id/dashboard', '/:id/campaigns', '/:id/leads', '/:id/kpis']) {
      expect(controller, `${backendPath} must be registered`).toContain(backendPath);
    }

    expect(app).toContain('path="events"');
    expect(app).toContain('path="events/new"');
    expect(app).toContain('path="events/:eventId"');
    expect(layout).toContain("label: 'Event Operations'");
    expect(layout).toContain("path: '/commercial-planning'");
    expect(app).toContain('path="commercial-plans"');

    for (const customerCue of [
      'Event Revenue Operations',
      'Event Queue',
      'Fallback KPI Correction',
      'Event Funnel',
      'Budget Control',
      'Channel Performance',
      'Leads For This Event',
      'KPI Evidence',
    ]) {
      expect(eventDashboard).toContain(customerCue);
    }

    const eventWizard = source('frontend', 'src', 'pages', 'EventStrategyWizard.tsx');
    for (const wizardCue of [
      'Create Event Strategy',
      'Event Strategy',
      'Event Type',
      'Event Basics',
      'Offer, Audience, and FOMO',
      'Channels and Team Requirements',
      'Create Event Workspace',
      'eventsApi.create',
    ]) {
      expect(eventWizard).toContain(wizardCue);
    }
  });
});
