import { z } from 'zod';
import { ForbiddenError, ValidationError } from '@shared/errors';
import * as eventService from '@modules/commercial-events/service';
import { createKpiRecordSchema, updateStrategySchema } from '@modules/commercial-events/types';
import * as problemService from '@modules/event-problem-log/service';
import { createProblemSchema } from '@modules/event-problem-log/types';
import * as leadService from '@modules/lead-lifecycle/service';
import { setTemperatureSchema, transitionLeadSchema } from '@modules/lead-lifecycle/types';
import * as plannerService from '@modules/event-campaign-planner/service';
import {
  createContentRequirementSchema,
  createEmailPlanSchema,
  createSalesTaskSchema,
  createUpsellPlanSchema,
  createWhatsappPlanSchema,
} from '@modules/event-campaign-planner/types';

const SUPPORTED_ACTIONS = [
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
] as const;

export type StitchiExecutableActionType = (typeof SUPPORTED_ACTIONS)[number];

const updateEventStrategyActionSchema = z.object({
  eventId: z.string().uuid(),
  strategy: updateStrategySchema,
});

const createEventKpiActionSchema = z.object({
  eventId: z.string().uuid(),
  kpi: createKpiRecordSchema,
});

const updateLeadStatusActionSchema = z.object({
  leadId: z.string().uuid(),
}).merge(transitionLeadSchema);

const setLeadTemperatureActionSchema = z.object({
  leadId: z.string().uuid(),
}).merge(setTemperatureSchema);

export function isExecutableStitchiAction(actionType: string): actionType is StitchiExecutableActionType {
  return SUPPORTED_ACTIONS.includes(actionType as StitchiExecutableActionType);
}

export function assertExecutableStitchiAction(actionType: string): asserts actionType is StitchiExecutableActionType {
  if (!isExecutableStitchiAction(actionType)) {
    throw new ValidationError(`Unsupported Stitchi action: ${actionType}`);
  }
}

export function requiresApprovalForAction(actionType: string): boolean {
  assertExecutableStitchiAction(actionType);
  return true;
}

export async function executeStitchiAction(input: {
  role: string;
  tenantKey: string;
  userId: string;
  actionType: string;
  inputPayload: unknown;
}): Promise<{ objectType: string; objectId: string; result: unknown }> {
  assertExecutableStitchiAction(input.actionType);

  switch (input.actionType) {
    case 'create_event_problem': {
      const payload = createProblemSchema.parse(input.inputPayload);
      const result = await problemService.createProblem(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'event_problem', objectId: result.id, result };
    }
    case 'update_event_strategy': {
      const payload = updateEventStrategyActionSchema.parse(input.inputPayload);
      const result = await eventService.updateEventStrategy(input.role, input.tenantKey, input.userId, payload.eventId, payload.strategy);
      return { objectType: 'commercial_event', objectId: result.id, result };
    }
    case 'create_event_kpi_record': {
      const payload = createEventKpiActionSchema.parse(input.inputPayload);
      const result = await eventService.createEventKpiRecord(input.role, input.tenantKey, input.userId, payload.eventId, payload.kpi);
      return { objectType: 'event_kpi_record', objectId: result.id, result };
    }
    case 'update_lead_status': {
      const payload = updateLeadStatusActionSchema.parse(input.inputPayload);
      const result = await leadService.transitionLead(input.role, input.tenantKey, input.userId, payload.leadId, {
        toStatus: payload.toStatus,
        reason: payload.reason,
      });
      return { objectType: 'lead_capture_record', objectId: result.id, result };
    }
    case 'set_lead_temperature': {
      const payload = setLeadTemperatureActionSchema.parse(input.inputPayload);
      const result = await leadService.setTemperature(input.role, input.tenantKey, input.userId, payload.leadId, {
        temperature: payload.temperature,
        reason: payload.reason,
      });
      return { objectType: 'lead_capture_record', objectId: result.id, result };
    }
    case 'create_email_plan': {
      const payload = createEmailPlanSchema.parse(input.inputPayload);
      const result = await plannerService.createEmailPlan(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'event_email_plan', objectId: result.id, result };
    }
    case 'create_whatsapp_plan': {
      const payload = createWhatsappPlanSchema.parse(input.inputPayload);
      const result = await plannerService.createWhatsappPlan(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'event_whatsapp_plan', objectId: result.id, result };
    }
    case 'create_upsell_plan': {
      const payload = createUpsellPlanSchema.parse(input.inputPayload);
      const result = await plannerService.createUpsellPlan(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'event_upsell_plan', objectId: result.id, result };
    }
    case 'create_content_requirement': {
      const payload = createContentRequirementSchema.parse(input.inputPayload);
      const result = await plannerService.createContentRequirement(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'event_content_requirement', objectId: result.id, result };
    }
    case 'create_sales_task': {
      const payload = createSalesTaskSchema.parse(input.inputPayload);
      const result = await plannerService.createSalesTask(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'event_sales_task', objectId: result.id, result };
    }
    default:
      throw new ForbiddenError('Stitchi action is not executable');
  }
}

export function supportedStitchiActions(): StitchiExecutableActionType[] {
  return [...SUPPORTED_ACTIONS];
}
