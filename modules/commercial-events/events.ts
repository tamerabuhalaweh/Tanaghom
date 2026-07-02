export const COMMERCIAL_EVENT_EVENTS = {
  EVENT_CREATED: 'commercial_event.created',
  EVENT_UPDATED: 'commercial_event.updated',
  EVENT_STRATEGY_UPDATED: 'commercial_event.strategy_updated',
  EVENT_STATUS_CHANGED: 'commercial_event.status_changed',
  EVENT_CAMPAIGN_LINKED: 'commercial_event.campaign_linked',
  EVENT_LEAD_LINKED: 'commercial_event.lead_linked',
} as const;

export interface CommercialEventCreatedEvent {
  eventId: string;
  tenantKey: string;
  ownerUserId: string;
  eventType: string;
  name: string;
  timestamp: Date;
}

export interface CommercialEventUpdatedEvent {
  eventId: string;
  tenantKey: string;
  changes: Record<string, unknown>;
  updatedBy: string;
  timestamp: Date;
}

export interface CommercialEventStrategyUpdatedEvent {
  eventId: string;
  tenantKey: string;
  updatedBy: string;
  timestamp: Date;
}

export interface CommercialEventStatusChangedEvent {
  eventId: string;
  tenantKey: string;
  fromStatus: string;
  toStatus: string;
  changedBy: string;
  reason?: string;
  timestamp: Date;
}

export interface CommercialEventCampaignLinkedEvent {
  eventId: string;
  campaignId: string;
  tenantKey: string;
  linkedBy: string;
  timestamp: Date;
}

export interface CommercialEventLeadLinkedEvent {
  eventId: string;
  leadId: string;
  tenantKey: string;
  linkedBy: string;
  timestamp: Date;
}
