export const PLANNER_EVENTS = {
  EMAIL_PLAN_CREATED: 'planner.email_plan_created',
  EMAIL_PLAN_UPDATED: 'planner.email_plan_updated',
  WHATSAPP_PLAN_CREATED: 'planner.whatsapp_plan_created',
  WHATSAPP_PLAN_UPDATED: 'planner.whatsapp_plan_updated',
  UPSELL_PLAN_CREATED: 'planner.upsell_plan_created',
  UPSELL_PLAN_UPDATED: 'planner.upsell_plan_updated',
  CONTENT_REQUIREMENT_CREATED: 'planner.content_requirement_created',
  CONTENT_REQUIREMENT_UPDATED: 'planner.content_requirement_updated',
  SALES_TASK_CREATED: 'planner.sales_task_created',
  SALES_TASK_UPDATED: 'planner.sales_task_updated',
} as const;

export interface PlannerItemEvent {
  itemId: string;
  tenantKey: string;
  eventId: string;
  itemType: string;
  timestamp: Date;
}
