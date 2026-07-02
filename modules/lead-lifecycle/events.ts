export const LEAD_LIFECYCLE_EVENTS = {
  LEAD_CREATED: 'lead.created',
  LEAD_UPDATED: 'lead.updated',
  LEAD_STATUS_CHANGED: 'lead.status_changed',
  LEAD_TEMPERATURE_CHANGED: 'lead.temperature_changed',
  LEAD_MEETING_RECORDED: 'lead.meeting_recorded',
  LEAD_PURCHASE_RECORDED: 'lead.purchase_recorded',
} as const;

export interface LeadLifecycleEvent {
  leadId: string;
  tenantKey: string;
  eventId?: string;
  fromStatus?: string;
  toStatus?: string;
  fromTemperature?: string;
  toTemperature?: string;
  actorUserId?: string;
  timestamp: Date;
}
