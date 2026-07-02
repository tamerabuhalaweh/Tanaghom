import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../shared/auth';
import { ENTERPRISE_CAPABILITIES } from '../modules/capability-registry/registry-data';
import { DEFAULT_PRODUCTION_ENTITLEMENTS, DEFAULT_PRODUCTION_PLAN_KEY } from '../modules/tenant-admin/subscription';

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

  const defaultTenant = await prisma.tenant.upsert({
    where: { tenant_key: 'default' },
    update: { name: 'Tanaghum Default Tenant', status: 'active' },
    create: {
      tenant_key: 'default',
      name: 'Tanaghum Default Tenant',
      status: 'active',
    },
  });
  console.log('  Tenant: default');

  const defaultPlan = await prisma.tenantPlan.upsert({
    where: { plan_key: DEFAULT_PRODUCTION_PLAN_KEY },
    update: {
      name: 'Commercial/Social Production',
      status: 'active',
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
    },
    create: {
      plan_key: DEFAULT_PRODUCTION_PLAN_KEY,
      name: 'Commercial/Social Production',
      description: 'Production Commercial/Social workspace with customer-owned AI and integration credentials.',
      status: 'active',
      billing_interval: 'monthly',
      currency: 'USD',
      entitlements: DEFAULT_PRODUCTION_ENTITLEMENTS,
    },
  });
  const currentSubscription = await prisma.tenantSubscription.findFirst({
    where: { tenant_key: defaultTenant.tenant_key, is_current: true },
  });
  if (!currentSubscription) {
    await prisma.tenantSubscription.create({
      data: {
        tenant_key: defaultTenant.tenant_key,
        plan_id: defaultPlan.id,
        status: 'active',
        source: 'manual',
        is_current: true,
        current_period_start: new Date(),
        current_period_end: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365),
        notes: 'Seeded default production entitlement subscription.',
      },
    });
    console.log('  TenantSubscription: default -> Commercial/Social Production');
  }

  // Seed admin user
  const adminPassword = await hashPassword('password123');
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@tanaghum.com' },
    update: {
      password_hash: adminPassword,
      is_active: true,
    },
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
        tenant_key: demandUser.tenant_key,
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
        where: { raw_message: campaign.raw_message, requester_id: demandUser.id, tenant_key: demandUser.tenant_key },
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

  // Seed demo commercial event — Sprint 59
  console.log('Seeding demo commercial event...');
  const adminForEvent = await prisma.user.findUnique({ where: { email: 'admin@tanaghum.com' } });

  if (adminForEvent) {
    const existingEvent = await prisma.commercialEvent.findFirst({
      where: { name: 'Tagyeer wa Irtaqi — Summer 2026', tenant_key: adminForEvent.tenant_key },
    });

    const eventData = {
      tenant_key: adminForEvent.tenant_key,
      name: 'Tagyeer wa Irtaqi — Summer 2026',
      event_type: 'tagyeer_wa_irtaqi' as const,
      event_date: new Date('2026-08-15T18:00:00Z'),
      location: 'Riyadh Convention Center, Saudi Arabia',
      campaign_start_date: new Date('2026-07-01T00:00:00Z'),
      campaign_end_date: new Date('2026-08-15T17:00:00Z'),
      expected_attendance: 200,
      revenue_target: 120000,
      planned_budget: 35000,
      owner_user_id: adminForEvent.id,
      status: 'planning' as const,
      offer: 'Early bird 25% off for first 80 registrants — regular price 600 SAR, early bird 450 SAR',
      audience: 'Young professionals aged 25-40 in Riyadh and Jeddah, interested in personal development, career growth, and life coaching',
      geography: 'Riyadh (primary), Jeddah (secondary), Dammam (tertiary)',
      fomo_angle: 'Only 200 seats available — last Tagyeer wa Irtaqi event sold out in 5 days. Early bird pricing ends July 20.',
      upsell_plan: 'VIP package at 1200 SAR includes: front-row seating, 1-on-1 30-min coaching session with Amro, signed workbook, and private WhatsApp group access for 3 months',
      selected_channels: ['instagram', 'whatsapp', 'email', 'linkedin'],
      content_department_requirements: '3 video testimonials from past attendees (60-90 sec each), 12 Instagram posts (mix of carousels and reels), 4 LinkedIn thought-leadership posts, 1 landing page with registration form, 3 email sequences (awareness, urgency, last-chance), WhatsApp broadcast message templates',
      sales_team_requirements: 'Follow up within 2 hours of registration, discovery call script for VIP upsell, no-show recovery call script, post-event feedback collection script, CRM handoff for qualified leads within 24 hours of event',
    };

    if (existingEvent) {
      await prisma.commercialEvent.update({ where: { id: existingEvent.id }, data: eventData });
    } else {
      await prisma.commercialEvent.create({ data: eventData });
    }
    console.log('  Commercial Event: Tagyeer wa Irtaqi — Summer 2026');
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

  // Seed demo campaign planner data — Sprint 61
  console.log('Seeding demo campaign planner data...');
  const demoEvent = await prisma.commercialEvent.findFirst({ where: { name: 'Tagyeer wa Irtaqi — Summer 2026' } });

  if (demoEvent && adminForEvent) {
    // Email plan
    const existingEmailPlan = await prisma.eventEmailPlan.findFirst({ where: { event_id: demoEvent.id, sequence_name: 'Awareness Sequence' } });
    if (!existingEmailPlan) {
      await prisma.eventEmailPlan.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          sequence_name: 'Awareness Sequence',
          audience_segment: 'Young professionals 25-40 in Riyadh',
          email_count: 3,
          planned_send_dates: ['2026-07-05T10:00:00Z', '2026-07-12T10:00:00Z', '2026-07-19T10:00:00Z'],
          subject_draft: 'Your career transformation starts here — Tagyeer wa Irtaqi',
          content_draft: 'Join 200+ professionals at Riyadh\'s premier personal development event...',
          content_type: 'html',
          approval_status: 'draft',
          created_by_user_id: adminForEvent.id,
        },
      });
      console.log('  Email Plan: Awareness Sequence');
    }

    // WhatsApp plan
    const existingWhatsappPlan = await prisma.eventWhatsappPlan.findFirst({ where: { event_id: demoEvent.id } });
    if (!existingWhatsappPlan) {
      await prisma.eventWhatsappPlan.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          audience_segment: 'Registered attendees',
          frequency: 'Weekly until event',
          content_type: 'text',
          message_draft: 'Assalamu alaikum! Only 3 weeks until Tagyeer wa Irtaqi. Have you secured your seat?',
          approval_status: 'draft',
          created_by_user_id: adminForEvent.id,
        },
      });
      console.log('  WhatsApp Plan: Registered attendees');
    }

    // Upsell plan
    const existingUpsellPlan = await prisma.eventUpsellPlan.findFirst({ where: { event_id: demoEvent.id } });
    if (!existingUpsellPlan) {
      await prisma.eventUpsellPlan.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          target_segment: 'Early bird registrants',
          offer: 'VIP upgrade: 1-on-1 coaching + front row + signed workbook',
          fomo_angle: 'Only 20 VIP spots available — 8 already taken',
          planned_channel: 'email',
          approval_status: 'draft',
          created_by_user_id: adminForEvent.id,
        },
      });
      console.log('  Upsell Plan: VIP upgrade');
    }

    // Content requirements
    const existingContentReq = await prisma.eventContentRequirement.findFirst({ where: { event_id: demoEvent.id } });
    if (!existingContentReq) {
      await prisma.eventContentRequirement.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          asset_type: 'video',
          description: '3 testimonial videos from past attendees (60-90 sec each)',
          platform: 'instagram',
          due_date: new Date('2026-07-10T23:59:59Z'),
          status: 'pending',
          created_by_user_id: adminForEvent.id,
        },
      });
      await prisma.eventContentRequirement.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          asset_type: 'landing_page',
          description: 'Registration landing page with early bird pricing',
          platform: 'website',
          due_date: new Date('2026-07-01T23:59:59Z'),
          status: 'in_progress',
          created_by_user_id: adminForEvent.id,
        },
      });
      console.log('  Content Requirements: 2 items');
    }

    // Sales tasks
    const existingSalesTask = await prisma.eventSalesTask.findFirst({ where: { event_id: demoEvent.id } });
    if (!existingSalesTask) {
      await prisma.eventSalesTask.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          task_type: 'follow_up',
          owner_role: 'sales_manager',
          description: 'Follow up within 2 hours of registration',
          due_date: new Date('2026-08-15T23:59:59Z'),
          status: 'pending',
          created_by_user_id: adminForEvent.id,
        },
      });
      await prisma.eventSalesTask.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          task_type: 'discovery_call',
          owner_role: 'sales_manager',
          description: 'Discovery call script for VIP upsell',
          due_date: new Date('2026-08-15T23:59:59Z'),
          status: 'pending',
          created_by_user_id: adminForEvent.id,
        },
      });
      console.log('  Sales Tasks: 2 items');
    }

    // Lead lifecycle demo data
    const existingLead = await prisma.leadCaptureRecord.findFirst({ where: { event_id: demoEvent.id, tenant_key: demoEvent.tenant_key } });
    if (!existingLead) {
      const agentRep = await prisma.agentRep.findFirst({ where: { user_id: adminForEvent.id } });
      const lead1 = await prisma.leadCaptureRecord.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          lead_status: 'meeting_booked',
          lead_temperature: 'hot',
          audience_source: 'follower',
          channel_attribution: 'instagram',
          lead_source: 'Instagram comment',
          lead_name_placeholder: 'Ahmed Al-Rashid',
          lead_email_placeholder: 'ahmed@example.com',
          lead_phone_placeholder: '+966501234567',
          platform: 'instagram',
          sales_notes: 'Interested in VIP package. Asked about coaching sessions.',
          next_action: 'Confirm meeting for July 20',
          follow_up_date: new Date('2026-07-20T10:00:00Z'),
          meeting_date: new Date('2026-07-22T14:00:00Z'),
          meeting_type: 'Discovery call',
          consent_status: 'granted',
          created_by_user_id: adminForEvent.id,
          created_by_agent_rep_id: agentRep?.id || adminForEvent.id,
        },
      });
      await prisma.leadLifecycleEvent.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          lead_id: lead1.id,
          to_status: 'new_lead',
          actor_user_id: adminForEvent.id,
          reason: 'Lead captured from Instagram comment',
        },
      });
      await prisma.leadLifecycleEvent.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          lead_id: lead1.id,
          from_status: 'new_lead',
          to_status: 'contacted',
          actor_user_id: adminForEvent.id,
          reason: 'WhatsApp follow-up sent',
        },
      });
      await prisma.leadLifecycleEvent.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          lead_id: lead1.id,
          from_status: 'contacted',
          to_status: 'meeting_booked',
          actor_user_id: adminForEvent.id,
          reason: 'Discovery call scheduled',
        },
      });

      const lead2 = await prisma.leadCaptureRecord.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          lead_status: 'contacted',
          lead_temperature: 'warm',
          audience_source: 'non_follower',
          channel_attribution: 'whatsapp',
          lead_source: 'WhatsApp broadcast',
          lead_name_placeholder: 'Fatima Hassan',
          lead_email_placeholder: 'fatima@example.com',
          platform: 'whatsapp',
          sales_notes: 'Responded to early bird offer. Needs more info about location.',
          next_action: 'Send venue details',
          follow_up_date: new Date('2026-07-18T10:00:00Z'),
          consent_status: 'granted',
          created_by_user_id: adminForEvent.id,
          created_by_agent_rep_id: agentRep?.id || adminForEvent.id,
        },
      });
      await prisma.leadLifecycleEvent.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          lead_id: lead2.id,
          to_status: 'new_lead',
          actor_user_id: adminForEvent.id,
          reason: 'Lead captured from WhatsApp broadcast',
        },
      });

      const lead3 = await prisma.leadCaptureRecord.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          lead_status: 'new_lead',
          lead_temperature: 'cold',
          audience_source: 'referral',
          channel_attribution: 'referral',
          lead_source: 'Referral from Ahmed',
          lead_name_placeholder: 'Omar Khalil',
          platform: 'email',
          consent_status: 'pending',
          created_by_user_id: adminForEvent.id,
          created_by_agent_rep_id: agentRep?.id || adminForEvent.id,
        },
      });
      console.log('  Lead Lifecycle: 3 demo leads with lifecycle events');
    }

    // Event problem/barrier demo data
    const existingProblem = await prisma.eventProblem.findFirst({ where: { event_id: demoEvent.id, tenant_key: demoEvent.tenant_key } });
    if (!existingProblem) {
      await prisma.eventProblem.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          title: 'Ad spend high but form completion rate low',
          description: 'Instagram ads are generating reach but form completion rate is only 2%. Budget is burning faster than expected without proportional lead capture.',
          category: 'ads',
          severity: 'high',
          status: 'investigating',
          source: 'kpi_review',
          impact_summary: 'Cost per lead 3x above target. Budget may run out before event date.',
          recommended_action: 'A/B test landing page copy. Review form length. Consider lead magnet offer.',
          owner_role: 'marketing_manager',
          created_by_user_id: adminForEvent.id,
        },
      });
      await prisma.eventProblem.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          title: 'WhatsApp follow-up delay exceeding 24 hours',
          description: 'Multiple leads report waiting 2-3 days for WhatsApp follow-up after registration. Response SLA is 2 hours.',
          category: 'sales',
          severity: 'high',
          status: 'open',
          source: 'sales_feedback',
          impact_summary: 'Lead temperature drops from hot to warm when follow-up is delayed. Conversion risk.',
          recommended_action: 'Assign dedicated sales person for event follow-up. Set up auto-reply template.',
          owner_role: 'sales_manager',
          created_by_user_id: adminForEvent.id,
        },
      });
      await prisma.eventProblem.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          title: 'Creative assets late from content team',
          description: 'Video testimonials and carousel designs are 5 days behind schedule. Content department needs updated deadline.',
          category: 'content',
          severity: 'medium',
          status: 'open',
          source: 'campaign_review',
          impact_summary: 'Campaign launch may be delayed. Missing early bird promotion window.',
          recommended_action: 'Escalate to department head. Prioritize video testimonials over carousels.',
          owner_role: 'marketing_manager',
          due_date: new Date('2026-07-10T23:59:59Z'),
          created_by_user_id: adminForEvent.id,
        },
      });
      await prisma.eventProblem.create({
        data: {
          tenant_key: demoEvent.tenant_key,
          event_id: demoEvent.id,
          title: 'No-show risk for booked meetings',
          description: '3 out of 8 booked discovery calls had no-shows last week. Pattern suggests reminder cadence is insufficient.',
          category: 'funnel',
          severity: 'medium',
          status: 'open',
          source: 'lead_review',
          impact_summary: 'No-show rate trending toward 37%. Target is under 15%.',
          recommended_action: 'Add SMS reminder 2 hours before call. Offer reschedule link. Send calendar invite immediately.',
          owner_role: 'sales_manager',
          created_by_user_id: adminForEvent.id,
        },
      });
      console.log('  Event Problems: 4 demo barriers');
    }
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
