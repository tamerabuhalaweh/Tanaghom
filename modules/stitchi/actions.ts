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
import * as commercialCenterService from '@modules/commercial-command-center/service';
import {
  createAssessmentSignalSchema,
  createCommercialPlanSchema,
  createRevenueLineSchema,
  updateCommercialPlanSchema,
} from '@modules/commercial-command-center/types';
import * as commercialDisciplineService from '@modules/commercial-disciplines/service';
import { createDisciplineRecordSchema } from '@modules/commercial-disciplines/types';
import * as commercialExecutiveService from '@modules/commercial-executive-reporting/service';
import { createExecutiveReportScheduleSchema } from '@modules/commercial-executive-reporting/types';
import * as annualPlanningService from '@modules/commercial-annual-planning/service';
import { createAnnualPlanSchema } from '@modules/commercial-annual-planning/types';

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
  'create_commercial_revenue_line',
  'create_commercial_plan',
  'create_commercial_plan_with_revenue_line',
  'update_commercial_plan',
  'create_commercial_assessment_signal',
  'create_commercial_discipline_record',
  'create_executive_report_schedule',
  'create_annual_commercial_plan',
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

const updateCommercialPlanActionSchema = z.object({
  commercialPlanId: z.string().uuid(),
  plan: updateCommercialPlanSchema,
});

const createCommercialPlanWithRevenueLineActionSchema = z.object({
  revenueLine: createRevenueLineSchema,
  plan: createCommercialPlanSchema.omit({ revenueLineId: true }),
});

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
    case 'create_commercial_revenue_line': {
      const payload = createRevenueLineSchema.parse(input.inputPayload);
      const result = await commercialCenterService.createRevenueLine(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'commercial_revenue_line', objectId: result.id || result.revenueLineType, result };
    }
    case 'create_commercial_plan': {
      const payload = createCommercialPlanSchema.parse(input.inputPayload);
      const result = await commercialCenterService.createPlan(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'commercial_plan', objectId: result.id, result };
    }
    case 'create_commercial_plan_with_revenue_line': {
      const payload = createCommercialPlanWithRevenueLineActionSchema.parse(input.inputPayload);
      const revenueLine = await commercialCenterService.createRevenueLine(input.role, input.tenantKey, input.userId, payload.revenueLine);
      if (!revenueLine.id) {
        throw new ValidationError('Commercial revenue line setup did not return a saved revenue line id');
      }
      const plan = await commercialCenterService.createPlan(input.role, input.tenantKey, input.userId, {
        ...payload.plan,
        revenueLineId: revenueLine.id,
      });
      return { objectType: 'commercial_plan', objectId: plan.id, result: { revenueLine, plan } };
    }
    case 'update_commercial_plan': {
      const payload = updateCommercialPlanActionSchema.parse(input.inputPayload);
      const result = await commercialCenterService.updatePlan(input.role, input.tenantKey, input.userId, payload.commercialPlanId, payload.plan);
      return { objectType: 'commercial_plan', objectId: result.id, result };
    }
    case 'create_commercial_assessment_signal': {
      const payload = createAssessmentSignalSchema.parse(input.inputPayload);
      const result = await commercialCenterService.createAssessmentSignal(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'commercial_assessment_signal', objectId: result.id, result };
    }
    case 'create_commercial_discipline_record': {
      const payload = createDisciplineRecordSchema.parse(input.inputPayload);
      const result = await commercialDisciplineService.createRecord(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'commercial_discipline_record', objectId: result.id, result };
    }
    case 'create_executive_report_schedule': {
      const payload = createExecutiveReportScheduleSchema.parse(input.inputPayload);
      const result = await commercialExecutiveService.createSchedule(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'commercial_executive_report_schedule', objectId: result.id, result };
    }
    case 'create_annual_commercial_plan': {
      const payload = createAnnualPlanSchema.parse(input.inputPayload);
      const result = await annualPlanningService.createAnnualPlan(input.role, input.tenantKey, input.userId, payload);
      return { objectType: 'annual_commercial_plan', objectId: result.id, result };
    }
    default:
      throw new ForbiddenError('Stitchi action is not executable');
  }
}

export function supportedStitchiActions(): StitchiExecutableActionType[] {
  return [...SUPPORTED_ACTIONS];
}
