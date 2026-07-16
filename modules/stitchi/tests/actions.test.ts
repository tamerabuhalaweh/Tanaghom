import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ValidationError } from '@shared/errors';

const problemServiceMocks = vi.hoisted(() => ({ createProblem: vi.fn() }));
const eventServiceMocks = vi.hoisted(() => ({ updateEventStrategy: vi.fn(), createEventKpiRecord: vi.fn() }));
const leadServiceMocks = vi.hoisted(() => ({ transitionLead: vi.fn(), setTemperature: vi.fn() }));
const plannerServiceMocks = vi.hoisted(() => ({
  createEmailPlan: vi.fn(),
  createWhatsappPlan: vi.fn(),
  createUpsellPlan: vi.fn(),
  createContentRequirement: vi.fn(),
  createSalesTask: vi.fn(),
}));
const commercialCenterMocks = vi.hoisted(() => ({
  createRevenueLine: vi.fn(),
  createPlan: vi.fn(),
  updatePlan: vi.fn(),
  createAssessmentSignal: vi.fn(),
}));
const commercialDisciplineMocks = vi.hoisted(() => ({
  createRecord: vi.fn(),
}));
const commercialExecutiveMocks = vi.hoisted(() => ({
  createSchedule: vi.fn(),
}));
const annualPlanningMocks = vi.hoisted(() => ({
  createAnnualPlan: vi.fn(),
  createPortfolioItem: vi.fn(),
  updatePortfolioItem: vi.fn(),
  transitionAnnualPlan: vi.fn(),
}));
const historicalAssessmentMocks = vi.hoisted(() => ({
  createAssessment: vi.fn(),
  generateAssessment: vi.fn(),
  decideFinding: vi.fn(),
}));
const commercialHierarchyMocks = vi.hoisted(() => ({
  assignPlan: vi.fn(),
  linkEvent: vi.fn(),
  linkCampaign: vi.fn(),
  linkLearning: vi.fn(),
}));
const commercialBudgetMocks = vi.hoisted(() => ({
  createBudgetAllocation: vi.fn(),
  reallocateBudget: vi.fn(),
  transitionBudgetAllocation: vi.fn(),
  verifyKpiEvidence: vi.fn(),
}));

vi.mock('@modules/event-problem-log/service', () => problemServiceMocks);
vi.mock('@modules/commercial-events/service', () => eventServiceMocks);
vi.mock('@modules/lead-lifecycle/service', () => leadServiceMocks);
vi.mock('@modules/event-campaign-planner/service', () => plannerServiceMocks);
vi.mock('@modules/commercial-command-center/service', () => commercialCenterMocks);
vi.mock('@modules/commercial-disciplines/service', () => commercialDisciplineMocks);
vi.mock('@modules/commercial-executive-reporting/service', () => commercialExecutiveMocks);
vi.mock('@modules/commercial-annual-planning/service', () => annualPlanningMocks);
vi.mock('@modules/commercial-historical-assessment/service', () => historicalAssessmentMocks);
vi.mock('@modules/commercial-plan-hierarchy/service', () => commercialHierarchyMocks);
vi.mock('@modules/commercial-budget-reconciliation/service', () => commercialBudgetMocks);

import { executeStitchiAction, supportedStitchiActions } from '../actions';

describe('Stitchi action registry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    problemServiceMocks.createProblem.mockResolvedValue({ id: 'problem-1', title: 'Follow-up delay' });
    eventServiceMocks.updateEventStrategy.mockResolvedValue({ id: 'event-1', name: 'Event' });
    eventServiceMocks.createEventKpiRecord.mockResolvedValue({ id: 'kpi-1' });
    leadServiceMocks.transitionLead.mockResolvedValue({ id: 'lead-1' });
    leadServiceMocks.setTemperature.mockResolvedValue({ id: 'lead-1' });
    plannerServiceMocks.createEmailPlan.mockResolvedValue({ id: 'email-plan-1' });
    plannerServiceMocks.createWhatsappPlan.mockResolvedValue({ id: 'whatsapp-plan-1' });
    plannerServiceMocks.createUpsellPlan.mockResolvedValue({ id: 'upsell-plan-1' });
    plannerServiceMocks.createContentRequirement.mockResolvedValue({ id: 'content-req-1' });
    plannerServiceMocks.createSalesTask.mockResolvedValue({ id: 'sales-task-1' });
    commercialCenterMocks.createRevenueLine.mockResolvedValue({ id: 'revenue-line-1', revenueLineType: 'online_course' });
    commercialCenterMocks.createPlan.mockResolvedValue({ id: 'commercial-plan-1' });
    commercialCenterMocks.updatePlan.mockResolvedValue({ id: 'commercial-plan-1' });
    commercialCenterMocks.createAssessmentSignal.mockResolvedValue({ id: 'commercial-signal-1' });
    commercialDisciplineMocks.createRecord.mockResolvedValue({ id: 'discipline-record-1' });
    commercialExecutiveMocks.createSchedule.mockResolvedValue({ id: 'executive-report-schedule-1' });
    annualPlanningMocks.createAnnualPlan.mockResolvedValue({ id: 'annual-plan-1', year: 2027 });
    annualPlanningMocks.createPortfolioItem.mockResolvedValue({ id: 'annual-plan-1', revision: 2 });
    annualPlanningMocks.updatePortfolioItem.mockResolvedValue({ id: 'annual-plan-1', revision: 3 });
    annualPlanningMocks.transitionAnnualPlan.mockResolvedValue({ id: 'annual-plan-1', status: 'approved' });
    historicalAssessmentMocks.createAssessment.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000920' });
    historicalAssessmentMocks.generateAssessment.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000920', status: 'generated' });
    historicalAssessmentMocks.decideFinding.mockResolvedValue({ id: '00000000-0000-0000-0000-000000000921', decision: 'approved' });
    commercialHierarchyMocks.assignPlan.mockResolvedValue({ id: 'commercial-plan-1' });
    commercialHierarchyMocks.linkEvent.mockResolvedValue({ id: 'commercial-plan-1' });
    commercialHierarchyMocks.linkCampaign.mockResolvedValue({ id: 'commercial-plan-1' });
    commercialHierarchyMocks.linkLearning.mockResolvedValue({ id: 'commercial-plan-1' });
    commercialBudgetMocks.createBudgetAllocation.mockResolvedValue({
      changedAllocationId: '00000000-0000-0000-0000-000000000902',
      allocations: [],
    });
    commercialBudgetMocks.reallocateBudget.mockResolvedValue({ allocations: [] });
    commercialBudgetMocks.transitionBudgetAllocation.mockResolvedValue({ allocations: [] });
    commercialBudgetMocks.verifyKpiEvidence.mockResolvedValue({
      id: '00000000-0000-0000-0000-000000000901',
      verificationStatus: 'verified',
      revision: 2,
    });
  });

  it('lists only production-supported internal actions', () => {
    expect(supportedStitchiActions()).toEqual([
      'create_event_problem',
      'update_event_strategy',
      'create_event_kpi_record',
      'update_lead_status',
      'set_lead_temperature',
      'create_email_plan',
      'create_whatsapp_plan',
      'create_upsell_plan',
      'create_content_requirement',
      'create_sales_task',
      'create_commercial_revenue_line',
      'create_commercial_plan',
      'create_commercial_plan_with_revenue_line',
      'update_commercial_plan',
      'create_commercial_assessment_signal',
      'create_commercial_discipline_record',
      'create_executive_report_schedule',
      'prepare_historical_commercial_assessment',
      'decide_historical_assessment_finding',
      'create_annual_commercial_plan',
      'create_monthly_portfolio_item',
      'update_monthly_portfolio_item',
      'transition_annual_commercial_plan',
      'assign_commercial_plan_hierarchy',
      'link_commercial_plan_event',
      'link_commercial_plan_campaign',
      'link_commercial_plan_learning',
      'create_commercial_budget_allocation',
      'reallocate_commercial_budget',
      'approve_commercial_budget',
      'commit_commercial_budget',
      'archive_commercial_budget',
      'review_commercial_spend_evidence',
    ]);
  });

  it('creates and generates a historical assessment using the original requester provider identity', async () => {
    const result = await executeStitchiAction({
      role: 'cco',
      tenantKey: 'tenant-a',
      userId: '00000000-0000-0000-0000-000000000001',
      requestingUserId: '00000000-0000-0000-0000-000000000002',
      actionType: 'prepare_historical_commercial_assessment',
      inputPayload: {
        title: '2025 commercial assessment',
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
        eventIds: [],
        campaignIds: [],
        channels: [],
      },
    });

    expect(historicalAssessmentMocks.createAssessment).toHaveBeenCalledWith(
      'cco',
      'tenant-a',
      '00000000-0000-0000-0000-000000000002',
      expect.objectContaining({ title: '2025 commercial assessment' }),
    );
    expect(historicalAssessmentMocks.generateAssessment).toHaveBeenCalledWith(
      'cco',
      'tenant-a',
      '00000000-0000-0000-0000-000000000002',
      '00000000-0000-0000-0000-000000000920',
    );
    expect(result.objectType).toBe('commercial_historical_assessment_run');
  });

  it('routes monthly portfolio creation through the annual planning state machine', async () => {
    await executeStitchiAction({
      role: 'cco',
      tenantKey: 'tenant-a',
      userId: '00000000-0000-0000-0000-000000000001',
      actionType: 'create_monthly_portfolio_item',
      inputPayload: {
        annualPlanId: '00000000-0000-0000-0000-000000000930',
        item: {
          expectedRevision: 4,
          month: 3,
          revenueLineId: '00000000-0000-0000-0000-000000000040',
          title: 'Leadership course launch',
          currency: 'AED',
          budgetAllocation: 50000,
          revenueTarget: 300000,
        },
      },
    });

    expect(annualPlanningMocks.createPortfolioItem).toHaveBeenCalledWith(
      'cco',
      'tenant-a',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000930',
      expect.objectContaining({ month: 3, expectedRevision: 4, currency: 'AED' }),
    );
  });

  it('routes verified spend review through the governed budget service', async () => {
    const result = await executeStitchiAction({
      role: 'cco',
      tenantKey: 'tenant-a',
      userId: '00000000-0000-0000-0000-000000000001',
      actionType: 'review_commercial_spend_evidence',
      inputPayload: {
        kpiId: '00000000-0000-0000-0000-000000000901',
        review: {
          expectedRevision: 1,
          decision: 'verified',
          reason: 'Matched the approved connector import evidence.',
        },
      },
    });

    expect(commercialBudgetMocks.verifyKpiEvidence).toHaveBeenCalledWith(
      'cco',
      'tenant-a',
      '00000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000901',
      expect.objectContaining({ decision: 'verified', expectedRevision: 1 }),
    );
    expect(result.objectType).toBe('event_kpi_record');
  });

  it('returns the exact allocation created by a governed Stitchi budget action', async () => {
    const result = await executeStitchiAction({
      role: 'department_head',
      tenantKey: 'tenant-a',
      userId: '00000000-0000-0000-0000-000000000001',
      actionType: 'create_commercial_budget_allocation',
      inputPayload: {
        annualPlanId: '00000000-0000-0000-0000-000000000900',
        allocation: {
          level: 'monthly_item',
          monthlyPortfolioItemId: '00000000-0000-0000-0000-000000000903',
          currency: 'AED',
          amount: 25000,
          reason: 'Fund the approved January course launch.',
        },
      },
    });

    expect(result).toMatchObject({
      objectType: 'commercial_budget_allocation',
      objectId: '00000000-0000-0000-0000-000000000902',
    });
    expect(commercialBudgetMocks.createBudgetAllocation).toHaveBeenCalled();
  });

  it('executes create_event_problem through the event problem service', async () => {
    const result = await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_event_problem',
      inputPayload: {
        eventId: '00000000-0000-0000-0000-000000000001',
        title: 'WhatsApp follow-up delay',
        category: 'sales',
      },
    });

    expect(problemServiceMocks.createProblem).toHaveBeenCalledWith('marketing_manager', 'tenant-a', 'user-1', expect.objectContaining({
      title: 'WhatsApp follow-up delay',
      category: 'sales',
    }));
    expect(result).toMatchObject({ objectType: 'event_problem', objectId: 'problem-1' });
  });

  it('executes update_lead_status through the lead lifecycle service', async () => {
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'update_lead_status',
      inputPayload: {
        leadId: '00000000-0000-0000-0000-000000000010',
        toStatus: 'contacted',
        reason: 'Sales called the lead',
      },
    });

    expect(leadServiceMocks.transitionLead).toHaveBeenCalledWith('marketing_manager', 'tenant-a', 'user-1', '00000000-0000-0000-0000-000000000010', {
      toStatus: 'contacted',
      reason: 'Sales called the lead',
    });
  });

  it('executes create_email_plan through the event planner service', async () => {
    const result = await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_email_plan',
      inputPayload: {
        eventId: '00000000-0000-0000-0000-000000000001',
        sequenceName: 'Buyer reminder sequence',
        emailCount: 3,
        contentType: 'text',
      },
    });

    expect(plannerServiceMocks.createEmailPlan).toHaveBeenCalledWith('marketing_manager', 'tenant-a', 'user-1', expect.objectContaining({
      sequenceName: 'Buyer reminder sequence',
      emailCount: 3,
    }));
    expect(result).toMatchObject({ objectType: 'event_email_plan', objectId: 'email-plan-1' });
  });

  it('executes create_whatsapp_plan through the event planner service', async () => {
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_whatsapp_plan',
      inputPayload: {
        eventId: '00000000-0000-0000-0000-000000000001',
        frequency: 'follow-up reminders',
        contentType: 'text',
      },
    });

    expect(plannerServiceMocks.createWhatsappPlan).toHaveBeenCalledWith('marketing_manager', 'tenant-a', 'user-1', expect.objectContaining({
      frequency: 'follow-up reminders',
      contentType: 'text',
    }));
  });

  it('executes content, upsell, and sales planner actions through governed services', async () => {
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_upsell_plan',
      inputPayload: {
        eventId: '00000000-0000-0000-0000-000000000001',
        offer: 'VIP upgrade',
      },
    });
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_content_requirement',
      inputPayload: {
        eventId: '00000000-0000-0000-0000-000000000001',
        assetType: 'video',
      },
    });
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_sales_task',
      inputPayload: {
        eventId: '00000000-0000-0000-0000-000000000001',
        taskType: 'follow_up',
      },
    });

    expect(plannerServiceMocks.createUpsellPlan).toHaveBeenCalledOnce();
    expect(plannerServiceMocks.createContentRequirement).toHaveBeenCalledOnce();
    expect(plannerServiceMocks.createSalesTask).toHaveBeenCalledOnce();
  });

  it('executes Commercial Command Center actions through governed services', async () => {
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_commercial_revenue_line',
      inputPayload: {
        revenueLineType: 'online_course',
        name: 'Online Courses',
      },
    });
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_commercial_plan',
      inputPayload: {
        revenueLineId: '00000000-0000-0000-0000-000000000020',
        horizon: 'quarterly',
        stage: 'strategy_planning',
        title: 'Q3 online course plan',
      },
    });
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_commercial_assessment_signal',
      inputPayload: {
        title: 'Course funnel needs review',
        severity: 'watch',
      },
    });

    expect(commercialCenterMocks.createRevenueLine).toHaveBeenCalledWith('marketing_manager', 'tenant-a', 'user-1', expect.objectContaining({
      revenueLineType: 'online_course',
      name: 'Online Courses',
    }));
    expect(commercialCenterMocks.createPlan).toHaveBeenCalledOnce();
    expect(commercialCenterMocks.createAssessmentSignal).toHaveBeenCalledOnce();
  });

  it('configures a missing revenue line before creating a commercial plan', async () => {
    commercialCenterMocks.createRevenueLine.mockResolvedValueOnce({
      id: '00000000-0000-0000-0000-000000000040',
      revenueLineType: 'online_course',
      name: 'Online Courses',
    });

    const result = await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_commercial_plan_with_revenue_line',
      inputPayload: {
        revenueLine: {
          revenueLineType: 'online_course',
          name: 'Online Courses',
          status: 'active',
          systemOfRecord: 'tanaghum',
        },
        plan: {
          horizon: 'product_or_event',
          stage: 'strategy_planning',
          title: 'Leadership course launch plan',
          objective: 'sell to entrepreneurs',
          audience: 'warm followers and previous buyers',
          budgetTarget: 5000,
          revenueTarget: 30000,
          actionPlan: 'content, ads, GHL follow-up, WhatsApp reminders',
          status: 'draft',
        },
      },
    });

    expect(commercialCenterMocks.createRevenueLine).toHaveBeenCalledWith('marketing_manager', 'tenant-a', 'user-1', expect.objectContaining({
      revenueLineType: 'online_course',
      name: 'Online Courses',
    }));
    expect(commercialCenterMocks.createPlan).toHaveBeenCalledWith('marketing_manager', 'tenant-a', 'user-1', expect.objectContaining({
      revenueLineId: '00000000-0000-0000-0000-000000000040',
      objective: 'sell to entrepreneurs',
      budgetTarget: 5000,
      revenueTarget: 30000,
    }));
    expect(result.objectType).toBe('commercial_plan');
  });

  it('executes governed Commercial Command Center plan updates', async () => {
    await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'update_commercial_plan',
      inputPayload: {
        commercialPlanId: '00000000-0000-0000-0000-000000000020',
        plan: {
          stage: 'implementation_engagement',
          status: 'active',
          objective: 'Move the course plan into execution.',
        },
      },
    });

    expect(commercialCenterMocks.updatePlan).toHaveBeenCalledWith(
      'marketing_manager',
      'tenant-a',
      'user-1',
      '00000000-0000-0000-0000-000000000020',
      expect.objectContaining({
        stage: 'implementation_engagement',
        status: 'active',
      }),
    );
  });

  it('executes commercial discipline records through the governed workspace service', async () => {
    const result = await executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_commercial_discipline_record',
      inputPayload: {
        discipline: 'conversion_closing',
        category: 'objection_handling',
        title: 'Handle price objection for leadership course',
        summary: 'Prepare a response for warm followers who hesitate on price.',
        priority: 'high',
        sourceType: 'stitchi',
      },
    });

    expect(commercialDisciplineMocks.createRecord).toHaveBeenCalledWith(
      'marketing_manager',
      'tenant-a',
      'user-1',
      expect.objectContaining({
        discipline: 'conversion_closing',
        category: 'objection_handling',
        title: 'Handle price objection for leadership course',
      }),
    );
    expect(result).toMatchObject({ objectType: 'commercial_discipline_record', objectId: 'discipline-record-1' });
  });

  it('executes executive report schedules through the governed reporting service', async () => {
    const result = await executeStitchiAction({
      role: 'cco',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_executive_report_schedule',
      inputPayload: {
        cadence: 'daily',
        timezone: 'Asia/Dubai',
        recipientRoles: ['admin', 'cco'],
        deliveryChannels: ['email', 'whatsapp'],
        reportLanguage: 'English',
        reportSections: ['executive_summary', 'revenue_lines', 'lead_funnel'],
        workingDaysOnly: true,
        sendHour: 9,
        sendMinute: 0,
        approvalRequired: false,
      },
    });

    expect(commercialExecutiveMocks.createSchedule).toHaveBeenCalledWith(
      'cco',
      'tenant-a',
      'user-1',
      expect.objectContaining({
        cadence: 'daily',
        recipientRoles: ['admin', 'cco'],
        deliveryChannels: ['email', 'whatsapp'],
        approvalRequired: false,
      }),
    );
    expect(result).toMatchObject({
      objectType: 'commercial_executive_report_schedule',
      objectId: 'executive-report-schedule-1',
    });
  });

  it('executes approved annual commercial plans through the governed annual planning service', async () => {
    const result = await executeStitchiAction({
      role: 'department_head',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'create_annual_commercial_plan',
      inputPayload: {
        year: 2027,
        title: '2027 Commercial Growth Plan',
        strategy: 'Use approved historical learning to sequence the annual portfolio.',
        currency: 'AED',
        budgetTarget: 500000,
        revenueTarget: 2500000,
        learningSetIds: ['00000000-0000-0000-0000-000000000090'],
      },
    });

    expect(annualPlanningMocks.createAnnualPlan).toHaveBeenCalledWith(
      'department_head',
      'tenant-a',
      'user-1',
      expect.objectContaining({
        year: 2027,
        currency: 'AED',
        budgetTarget: 500000,
        revenueTarget: 2500000,
      }),
    );
    expect(result).toMatchObject({ objectType: 'annual_commercial_plan', objectId: 'annual-plan-1' });
  });

  it('executes commercial hierarchy actions only through the governed hierarchy service', async () => {
    const commercialPlanId = '00000000-0000-0000-0000-000000000020';
    const annualPlanId = '00000000-0000-0000-0000-000000000021';
    const monthlyPortfolioItemId = '00000000-0000-0000-0000-000000000022';
    const eventId = '00000000-0000-0000-0000-000000000023';
    const campaignId = '00000000-0000-0000-0000-000000000024';
    const learningSetId = '00000000-0000-0000-0000-000000000025';
    const findingId = '00000000-0000-0000-0000-000000000026';

    await executeStitchiAction({
      role: 'marketing_manager', tenantKey: 'tenant-a', userId: 'user-1',
      actionType: 'assign_commercial_plan_hierarchy',
      inputPayload: { commercialPlanId, annualPlanId, monthlyPortfolioItemId },
    });
    await executeStitchiAction({
      role: 'marketing_manager', tenantKey: 'tenant-a', userId: 'user-1',
      actionType: 'link_commercial_plan_event',
      inputPayload: { commercialPlanId, eventId, primary: true },
    });
    await executeStitchiAction({
      role: 'marketing_manager', tenantKey: 'tenant-a', userId: 'user-1',
      actionType: 'link_commercial_plan_campaign',
      inputPayload: { commercialPlanId, campaignId },
    });
    await executeStitchiAction({
      role: 'marketing_manager', tenantKey: 'tenant-a', userId: 'user-1',
      actionType: 'link_commercial_plan_learning',
      inputPayload: { commercialPlanId, learningSetId, findingIds: [findingId] },
    });

    expect(commercialHierarchyMocks.assignPlan).toHaveBeenCalledWith(
      'marketing_manager', 'tenant-a', 'user-1', commercialPlanId,
      { annualPlanId, monthlyPortfolioItemId },
    );
    expect(commercialHierarchyMocks.linkEvent).toHaveBeenCalledWith(
      'marketing_manager', 'tenant-a', 'user-1', commercialPlanId,
      { eventId, primary: true, periodExceptionReason: undefined },
    );
    expect(commercialHierarchyMocks.linkCampaign).toHaveBeenCalledWith(
      'marketing_manager', 'tenant-a', 'user-1', commercialPlanId,
      { campaignId, periodExceptionReason: undefined },
    );
    expect(commercialHierarchyMocks.linkLearning).toHaveBeenCalledWith(
      'marketing_manager', 'tenant-a', 'user-1', commercialPlanId,
      { learningSetId, findingIds: [findingId], rationale: undefined },
    );
  });

  it('rejects unsupported external/write actions', async () => {
    await expect(executeStitchiAction({
      role: 'marketing_manager',
      tenantKey: 'tenant-a',
      userId: 'user-1',
      actionType: 'publish_to_postiz',
      inputPayload: {},
    })).rejects.toThrow(ValidationError);
  });
});
