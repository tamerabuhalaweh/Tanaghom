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

vi.mock('@modules/event-problem-log/service', () => problemServiceMocks);
vi.mock('@modules/commercial-events/service', () => eventServiceMocks);
vi.mock('@modules/lead-lifecycle/service', () => leadServiceMocks);
vi.mock('@modules/event-campaign-planner/service', () => plannerServiceMocks);
vi.mock('@modules/commercial-command-center/service', () => commercialCenterMocks);
vi.mock('@modules/commercial-disciplines/service', () => commercialDisciplineMocks);

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
    ]);
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
