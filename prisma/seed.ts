import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/auth';
import { ENTERPRISE_CAPABILITIES } from '../modules/capability-registry/registry-data';

const prisma = new PrismaClient();

// DEVELOPMENT-ONLY SEED DATA
// This file creates sample users for local development and testing.
// These users must NOT be used in production. Production users should
// be created through the admin API or a separate provisioning process.

const DEPARTMENTS = [
  { name: 'Brand & Market Intelligence', description: 'Brand voice, positioning, market research, competitive intelligence, trend analysis' },
  { name: 'Demand Generation', description: 'Content strategy, SEO, algorithm optimization, reach, hashtag strategy, amplification' },
  { name: 'Conversion', description: 'CTA optimization, landing pages, WhatsApp flow, objection handling, sales routing' },
  { name: 'Customer Growth & Retention', description: 'Upsell, re-engagement, community, loyalty, nurturing, retention campaigns' },
  { name: 'Revenue Operations', description: 'CRM management, reporting, attribution, dashboards, analytics, pipeline visibility' },
];

const FUNCTIONAL_AGENTS = [
  { name: 'Content_Strategy_Agent', capability: 'content_strategy', description: 'Creates themes, calendars, topic angles, weekly plans' },
  { name: 'Algorithm_Intelligence_Agent', capability: 'algorithm_intelligence', description: 'Reach Readiness Score, trend rules, platform optimization' },
  { name: 'Analytics_KPI_Agent', capability: 'analytics_kpi', description: 'Pulls analytics, writes structured insights' },
  { name: 'Graphic_Design_Agent', capability: 'graphic_design', description: 'Creates visual assets for social media content' },
];

const GOVERNANCE_AGENTS = [
  { name: 'CCO_Governance_Agent', policyScope: ['approval', 'strategic_content'], vetoAuthority: true, description: 'CCO oversight for sensitive content' },
  { name: 'Compliance_Governance_Agent', policyScope: ['compliance', 'brand_safety'], vetoAuthority: true, description: 'Compliance and brand safety enforcement' },
  { name: 'Approval_Governance_Agent', policyScope: ['approval_workflow'], vetoAuthority: false, description: 'Approval workflow governance' },
];

async function seed() {
  console.log('Seeding database...');

  // Seed departments
  for (const dept of DEPARTMENTS) {
    await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: dept,
    });
    console.log(`  Department: ${dept.name}`);
  }

  // Seed admin user
  const adminPassword = await hashPassword('admin123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tanaghum.com' },
    update: {},
    create: {
      email: 'admin@tanaghum.com',
      name: 'Admin',
      password_hash: adminPassword,
      role: 'admin',
      is_active: true,
    },
  });
  console.log('  User: admin@tanaghum.com (role: admin)');

  // Create AgentRep for admin
  const adminAgentRep = await prisma.agentRep.upsert({
    where: { user_id: adminUser.id },
    update: {},
    create: {
      user_id: adminUser.id,
      name: 'Admin AgentRep',
      agent_type: 'functional',
      status: 'active',
    },
  });
  console.log('  AgentRep: Admin AgentRep (for admin@tanaghum.com)');

  // Seed sample users for each department role
  const sampleUsers = [
    { email: 'cco@tanaghum.com', name: 'CCO', role: 'cco' as const, deptName: null },
    { email: 'brand.head@tanaghum.com', name: 'Brand Head', role: 'department_head' as const, deptName: 'Brand & Market Intelligence' },
    { email: 'demand.specialist@tanaghum.com', name: 'Demand Specialist', role: 'specialist' as const, deptName: 'Demand Generation' },
    { email: 'conversion.reviewer@tanaghum.com', name: 'Conversion Reviewer', role: 'reviewer' as const, deptName: 'Conversion' },
    { email: 'growth.viewer@tanaghum.com', name: 'Growth Viewer', role: 'viewer' as const, deptName: 'Customer Growth & Retention' },
    { email: 'revops.head@tanaghum.com', name: 'RevOps Head', role: 'department_head' as const, deptName: 'Revenue Operations' },
  ];

  const defaultPassword = await hashPassword('password123');
  for (const user of sampleUsers) {
    const dept = user.deptName ? await prisma.department.findUnique({ where: { name: user.deptName } }) : null;
    const createdUser = await prisma.user.upsert({
      where: { email: user.email },
      update: {},
      create: {
        email: user.email,
        name: user.name,
        password_hash: defaultPassword,
        role: user.role,
        department_id: dept?.id,
        is_active: true,
      },
    });
    console.log(`  User: ${user.email} (role: ${user.role}, dept: ${user.deptName ?? 'executive authority'})`);

    // Create AgentRep for each user
    const agentRepName = `${user.name} AgentRep`;
    const agentRep = await prisma.agentRep.upsert({
      where: { user_id: createdUser.id },
      update: {},
      create: {
        user_id: createdUser.id,
        name: agentRepName,
        agent_type: user.role === 'cco' ? 'governance' : 'functional',
        status: 'active',
      },
    });
    console.log(`  AgentRep: ${agentRepName} (for ${user.email})`);

    // Assign functional agents to non-CCO users
    if (user.role !== 'cco') {
      for (const fa of FUNCTIONAL_AGENTS) {
        await prisma.functionalAgent.upsert({
          where: { id: `${agentRep.id}-${fa.name}` },
          update: {},
          create: {
            agent_rep_id: agentRep.id,
            name: fa.name,
            capability: fa.capability,
            description: fa.description,
            status: 'active',
          },
        });
      }
      console.log(`    FunctionalAgents: ${FUNCTIONAL_AGENTS.length} agents assigned`);
    }

    // Assign governance agents to CCO
    if (user.role === 'cco') {
      for (const ga of GOVERNANCE_AGENTS) {
        await prisma.governanceAgent.upsert({
          where: { id: `${agentRep.id}-${ga.name}` },
          update: {},
          create: {
            agent_rep_id: agentRep.id,
            name: ga.name,
            policy_scope: ga.policyScope,
            veto_authority: ga.vetoAuthority,
            description: ga.description,
            status: 'active',
          },
        });
      }
      console.log(`    GovernanceAgents: ${GOVERNANCE_AGENTS.length} agents assigned`);
    }
  }

  // Seed capabilities from shared registry data
  console.log('Seeding capabilities from registry...');
  for (const cap of ENTERPRISE_CAPABILITIES) {
    await prisma.capability.upsert({
      where: { name: cap.name },
      update: {
        description: cap.description,
        category: cap.category,
        risk_level: cap.riskLevel as 'low' | 'medium' | 'high' | 'critical',
        requires_approval: cap.requiresApproval,
        requires_saif_decision: cap.requiresSaifDecision,
        allowed_agent_types: cap.allowedAgentTypes,
      },
      create: {
        name: cap.name,
        description: cap.description,
        category: cap.category,
        risk_level: cap.riskLevel as 'low' | 'medium' | 'high' | 'critical',
        requires_approval: cap.requiresApproval,
        requires_saif_decision: cap.requiresSaifDecision,
        allowed_agent_types: cap.allowedAgentTypes,
      },
    });
    console.log(`  Capability: ${cap.name} [${cap.implemented ? 'implemented' : 'planned'}]`);
  }

  // Seed demo campaigns
  console.log('Seeding demo campaigns...');
  const demandUser = await prisma.user.findUnique({ where: { email: 'demand.specialist@tanaghum.com' } });

  if (demandUser) {
    const demoCampaigns = [
      {
        raw_message: 'Summer Wellness Launch',
        objective: 'Promote wellness course to health-conscious professionals on LinkedIn and Instagram',
        status: 'draft' as const,
        risk_category: 'medium' as const,
        target_platforms: ['linkedin', 'instagram'],
        audience: 'Health-conscious professionals aged 25-45',
        channel: 'social_media',
        content_type: 'campaign' as const,
        requester_id: demandUser.id,
      },
      {
        raw_message: 'Product Feature Announcement',
        objective: 'Announce new product features to existing customers',
        status: 'approved' as const,
        risk_category: 'low' as const,
        target_platforms: ['linkedin', 'twitter'],
        audience: 'Existing customers and partners',
        channel: 'social_media',
        content_type: 'campaign' as const,
        requester_id: demandUser.id,
      },
    ];

    for (const campaign of demoCampaigns) {
      const existing = await prisma.contentRequest.findFirst({
        where: { raw_message: campaign.raw_message, requester_id: demandUser.id },
      });
      if (existing) {
        await prisma.contentRequest.update({
          where: { id: existing.id },
          data: campaign,
        });
      } else {
        await prisma.contentRequest.create({
          data: campaign,
        });
      }
      console.log(`  Campaign: ${campaign.raw_message}`);
    }
  }

  // Seed mock MCP connectors (future/planned only)
  console.log('Seeding mock MCP connectors...');
  const MOCK_CONNECTORS = [
    {
      name: 'future_postiz_mcp',
      description: 'Future MCP connector for Postiz publishing platform',
      connectorType: 'publishing',
      targetSystem: 'Postiz',
      status: 'planned',
      isExternal: true,
      supportsRead: true,
      supportsWrite: false,
      m4Allowed: true,
      m5Allowed: false,
      credentialRequired: true,
    },
    {
      name: 'future_resourcespace_mcp',
      description: 'Future MCP connector for ResourceSpace DAM',
      connectorType: 'asset_management',
      targetSystem: 'ResourceSpace',
      status: 'planned',
      isExternal: true,
      supportsRead: true,
      supportsWrite: false,
      m4Allowed: true,
      m5Allowed: false,
      credentialRequired: true,
    },
    {
      name: 'future_analytics_social_mcp',
      description: 'Future MCP connector for social media analytics',
      connectorType: 'analytics',
      targetSystem: 'Social Platforms',
      status: 'planned',
      isExternal: true,
      supportsRead: true,
      supportsWrite: false,
      m4Allowed: true,
      m5Allowed: false,
      credentialRequired: true,
    },
    {
      name: 'future_rendering_mcp',
      description: 'Future MCP connector for rendering tools',
      connectorType: 'rendering',
      targetSystem: 'Rendering Tools',
      status: 'planned',
      isExternal: true,
      supportsRead: true,
      supportsWrite: false,
      m4Allowed: true,
      m5Allowed: false,
      credentialRequired: true,
    },
    {
      name: 'future_crm_whatsapp_mcp',
      description: 'Future MCP connector for CRM and WhatsApp',
      connectorType: 'crm_messaging',
      targetSystem: 'CRM/WhatsApp',
      status: 'planned',
      isExternal: true,
      supportsRead: true,
      supportsWrite: false,
      m4Allowed: true,
      m5Allowed: false,
      credentialRequired: true,
    },
    {
      name: 'future_spine_postgres_mcp',
      description: 'Future MCP connector for SPINE PostgreSQL database',
      connectorType: 'database',
      targetSystem: 'PostgreSQL',
      status: 'planned',
      isExternal: false,
      supportsRead: true,
      supportsWrite: false,
      m4Allowed: true,
      m5Allowed: false,
      credentialRequired: true,
    },
  ];

  for (const connector of MOCK_CONNECTORS) {
    await prisma.mcpConnector.upsert({
      where: { name: connector.name },
      update: {
        description: connector.description,
        connector_type: connector.connectorType,
        target_system: connector.targetSystem,
        status: connector.status as 'planned',
      },
      create: {
        name: connector.name,
        description: connector.description,
        connector_type: connector.connectorType,
        target_system: connector.targetSystem,
        status: connector.status as 'planned',
        is_external: connector.isExternal,
        supports_read: connector.supportsRead,
        supports_write: connector.supportsWrite,
        m4_allowed: connector.m4Allowed,
        m5_allowed: connector.m5Allowed,
        credential_required: connector.credentialRequired,
      },
    });
    console.log(`  MCP Connector: ${connector.name}`);
  }

  console.log('Seeding complete.');
}

seed()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
