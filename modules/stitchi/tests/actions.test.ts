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

vi.mock('@modules/event-problem-log/service', () => problemServiceMocks);
vi.mock('@modules/commercial-events/service', () => eventServiceMocks);
vi.mock('@modules/lead-lifecycle/service', () => leadServiceMocks);
vi.mock('@modules/event-campaign-planner/service', () => plannerServiceMocks);

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
