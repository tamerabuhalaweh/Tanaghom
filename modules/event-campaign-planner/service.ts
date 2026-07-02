import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import { PLANNER_EVENTS, type PlannerItemEvent } from './events';
import { checkPlannerPermission } from './policy';
import * as repo from './repository';
import type {
  CreateEmailPlanInput, UpdateEmailPlanInput, EmailPlanSummary,
  CreateWhatsappPlanInput, UpdateWhatsappPlanInput, WhatsappPlanSummary,
  CreateUpsellPlanInput, UpdateUpsellPlanInput, UpsellPlanSummary,
  CreateContentRequirementInput, UpdateContentRequirementInput, ContentRequirementSummary,
  CreateSalesTaskInput, UpdateSalesTaskInput, SalesTaskSummary,
} from './types';

// Email Plans
export async function listEmailPlans(role: string, tenantKey: string, eventId: string): Promise<EmailPlanSummary[]> {
  checkPlannerPermission(role, 'planner:read');
  return repo.listEmailPlans(tenantKey, eventId);
}

export async function getEmailPlan(role: string, tenantKey: string, id: string): Promise<EmailPlanSummary> {
  checkPlannerPermission(role, 'planner:read');
  return repo.getEmailPlanById(tenantKey, id);
}

export async function createEmailPlan(role: string, tenantKey: string, userId: string, input: CreateEmailPlanInput): Promise<EmailPlanSummary> {
  checkPlannerPermission(role, 'planner:create');
  const plan = await repo.createEmailPlan(tenantKey, userId, input);
  auditLog({ actor: `user:${userId}`, action: 'email_plan_created', object_type: 'event_email_plan', object_id: plan.id, result: 'success' }, `Email plan created: ${plan.sequenceName}`);
  await eventBus.emit(PLANNER_EVENTS.EMAIL_PLAN_CREATED, { itemId: plan.id, tenantKey, eventId: input.eventId, itemType: 'email_plan', timestamp: new Date() } as PlannerItemEvent);
  return plan;
}

export async function updateEmailPlan(role: string, tenantKey: string, userId: string, id: string, input: UpdateEmailPlanInput): Promise<EmailPlanSummary> {
  checkPlannerPermission(role, 'planner:update');
  const plan = await repo.updateEmailPlan(tenantKey, id, input);
  auditLog({ actor: `user:${userId}`, action: 'email_plan_updated', object_type: 'event_email_plan', object_id: id, result: 'success' }, `Email plan updated: ${plan.sequenceName}`);
  await eventBus.emit(PLANNER_EVENTS.EMAIL_PLAN_UPDATED, { itemId: id, tenantKey, eventId: plan.eventId, itemType: 'email_plan', timestamp: new Date() } as PlannerItemEvent);
  return plan;
}

// WhatsApp Plans
export async function listWhatsappPlans(role: string, tenantKey: string, eventId: string): Promise<WhatsappPlanSummary[]> {
  checkPlannerPermission(role, 'planner:read');
  return repo.listWhatsappPlans(tenantKey, eventId);
}

export async function getWhatsappPlan(role: string, tenantKey: string, id: string): Promise<WhatsappPlanSummary> {
  checkPlannerPermission(role, 'planner:read');
  return repo.getWhatsappPlanById(tenantKey, id);
}

export async function createWhatsappPlan(role: string, tenantKey: string, userId: string, input: CreateWhatsappPlanInput): Promise<WhatsappPlanSummary> {
  checkPlannerPermission(role, 'planner:create');
  const plan = await repo.createWhatsappPlan(tenantKey, userId, input);
  auditLog({ actor: `user:${userId}`, action: 'whatsapp_plan_created', object_type: 'event_whatsapp_plan', object_id: plan.id, result: 'success' }, `WhatsApp plan created for event ${input.eventId}`);
  await eventBus.emit(PLANNER_EVENTS.WHATSAPP_PLAN_CREATED, { itemId: plan.id, tenantKey, eventId: input.eventId, itemType: 'whatsapp_plan', timestamp: new Date() } as PlannerItemEvent);
  return plan;
}

export async function updateWhatsappPlan(role: string, tenantKey: string, userId: string, id: string, input: UpdateWhatsappPlanInput): Promise<WhatsappPlanSummary> {
  checkPlannerPermission(role, 'planner:update');
  const plan = await repo.updateWhatsappPlan(tenantKey, id, input);
  auditLog({ actor: `user:${userId}`, action: 'whatsapp_plan_updated', object_type: 'event_whatsapp_plan', object_id: id, result: 'success' }, `WhatsApp plan updated`);
  await eventBus.emit(PLANNER_EVENTS.WHATSAPP_PLAN_UPDATED, { itemId: id, tenantKey, eventId: plan.eventId, itemType: 'whatsapp_plan', timestamp: new Date() } as PlannerItemEvent);
  return plan;
}

// Upsell Plans
export async function listUpsellPlans(role: string, tenantKey: string, eventId: string): Promise<UpsellPlanSummary[]> {
  checkPlannerPermission(role, 'planner:read');
  return repo.listUpsellPlans(tenantKey, eventId);
}

export async function getUpsellPlan(role: string, tenantKey: string, id: string): Promise<UpsellPlanSummary> {
  checkPlannerPermission(role, 'planner:read');
  return repo.getUpsellPlanById(tenantKey, id);
}

export async function createUpsellPlan(role: string, tenantKey: string, userId: string, input: CreateUpsellPlanInput): Promise<UpsellPlanSummary> {
  checkPlannerPermission(role, 'planner:create');
  const plan = await repo.createUpsellPlan(tenantKey, userId, input);
  auditLog({ actor: `user:${userId}`, action: 'upsell_plan_created', object_type: 'event_upsell_plan', object_id: plan.id, result: 'success' }, `Upsell plan created for event ${input.eventId}`);
  await eventBus.emit(PLANNER_EVENTS.UPSELL_PLAN_CREATED, { itemId: plan.id, tenantKey, eventId: input.eventId, itemType: 'upsell_plan', timestamp: new Date() } as PlannerItemEvent);
  return plan;
}

export async function updateUpsellPlan(role: string, tenantKey: string, userId: string, id: string, input: UpdateUpsellPlanInput): Promise<UpsellPlanSummary> {
  checkPlannerPermission(role, 'planner:update');
  const plan = await repo.updateUpsellPlan(tenantKey, id, input);
  auditLog({ actor: `user:${userId}`, action: 'upsell_plan_updated', object_type: 'event_upsell_plan', object_id: id, result: 'success' }, `Upsell plan updated`);
  await eventBus.emit(PLANNER_EVENTS.UPSELL_PLAN_UPDATED, { itemId: id, tenantKey, eventId: plan.eventId, itemType: 'upsell_plan', timestamp: new Date() } as PlannerItemEvent);
  return plan;
}

// Content Requirements
export async function listContentRequirements(role: string, tenantKey: string, eventId: string): Promise<ContentRequirementSummary[]> {
  checkPlannerPermission(role, 'planner:read');
  return repo.listContentRequirements(tenantKey, eventId);
}

export async function getContentRequirement(role: string, tenantKey: string, id: string): Promise<ContentRequirementSummary> {
  checkPlannerPermission(role, 'planner:read');
  return repo.getContentRequirementById(tenantKey, id);
}

export async function createContentRequirement(role: string, tenantKey: string, userId: string, input: CreateContentRequirementInput): Promise<ContentRequirementSummary> {
  checkPlannerPermission(role, 'planner:create');
  const req = await repo.createContentRequirement(tenantKey, userId, input);
  auditLog({ actor: `user:${userId}`, action: 'content_requirement_created', object_type: 'event_content_requirement', object_id: req.id, result: 'success' }, `Content requirement created: ${req.assetType}`);
  await eventBus.emit(PLANNER_EVENTS.CONTENT_REQUIREMENT_CREATED, { itemId: req.id, tenantKey, eventId: input.eventId, itemType: 'content_requirement', timestamp: new Date() } as PlannerItemEvent);
  return req;
}

export async function updateContentRequirement(role: string, tenantKey: string, userId: string, id: string, input: UpdateContentRequirementInput): Promise<ContentRequirementSummary> {
  checkPlannerPermission(role, 'planner:update');
  const req = await repo.updateContentRequirement(tenantKey, id, input);
  auditLog({ actor: `user:${userId}`, action: 'content_requirement_updated', object_type: 'event_content_requirement', object_id: id, result: 'success' }, `Content requirement updated`);
  await eventBus.emit(PLANNER_EVENTS.CONTENT_REQUIREMENT_UPDATED, { itemId: id, tenantKey, eventId: req.eventId, itemType: 'content_requirement', timestamp: new Date() } as PlannerItemEvent);
  return req;
}

// Sales Tasks
export async function listSalesTasks(role: string, tenantKey: string, eventId: string): Promise<SalesTaskSummary[]> {
  checkPlannerPermission(role, 'planner:read');
  return repo.listSalesTasks(tenantKey, eventId);
}

export async function getSalesTask(role: string, tenantKey: string, id: string): Promise<SalesTaskSummary> {
  checkPlannerPermission(role, 'planner:read');
  return repo.getSalesTaskById(tenantKey, id);
}

export async function createSalesTask(role: string, tenantKey: string, userId: string, input: CreateSalesTaskInput): Promise<SalesTaskSummary> {
  checkPlannerPermission(role, 'planner:create');
  const task = await repo.createSalesTask(tenantKey, userId, input);
  auditLog({ actor: `user:${userId}`, action: 'sales_task_created', object_type: 'event_sales_task', object_id: task.id, result: 'success' }, `Sales task created: ${task.taskType}`);
  await eventBus.emit(PLANNER_EVENTS.SALES_TASK_CREATED, { itemId: task.id, tenantKey, eventId: input.eventId, itemType: 'sales_task', timestamp: new Date() } as PlannerItemEvent);
  return task;
}

export async function updateSalesTask(role: string, tenantKey: string, userId: string, id: string, input: UpdateSalesTaskInput): Promise<SalesTaskSummary> {
  checkPlannerPermission(role, 'planner:update');
  const task = await repo.updateSalesTask(tenantKey, id, input);
  auditLog({ actor: `user:${userId}`, action: 'sales_task_updated', object_type: 'event_sales_task', object_id: id, result: 'success' }, `Sales task updated`);
  await eventBus.emit(PLANNER_EVENTS.SALES_TASK_UPDATED, { itemId: id, tenantKey, eventId: task.eventId, itemType: 'sales_task', timestamp: new Date() } as PlannerItemEvent);
  return task;
}
