import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import {
  COMMERCIAL_EVENT_EVENTS,
  type CommercialEventCreatedEvent,
  type CommercialEventUpdatedEvent,
  type CommercialEventStrategyUpdatedEvent,
  type CommercialEventStatusChangedEvent,
  type CommercialEventCampaignLinkedEvent,
  type CommercialEventLeadLinkedEvent,
} from './events';
import { validateEventTransition, type CommercialEventStatus } from './types';
import { checkEventPermission } from './policy';
import * as repo from './repository';
import type {
  CreateEventInput,
  UpdateEventInput,
  UpdateStrategyInput,
  CreateKpiRecordInput,
  UpdateKpiRecordInput,
  CommercialEventSummary,
  EventDashboardSummary,
  EventKpiRecordSummary,
} from './types';

export async function listEvents(
  requesterRole: string,
  tenantKey: string,
  status?: CommercialEventStatus,
  eventType?: string,
): Promise<CommercialEventSummary[]> {
  checkEventPermission(requesterRole, 'events:read');
  return repo.listEvents(tenantKey, status, eventType);
}

export async function getEvent(
  requesterRole: string,
  tenantKey: string,
  id: string,
): Promise<CommercialEventSummary> {
  checkEventPermission(requesterRole, 'events:read');
  return repo.getEventById(tenantKey, id);
}

export async function createEvent(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  input: CreateEventInput,
): Promise<CommercialEventSummary> {
  checkEventPermission(requesterRole, 'events:create');
  const event = await repo.createEvent(tenantKey, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_created',
      object_type: 'commercial_event',
      object_id: event.id,
      result: 'success',
    },
    `Commercial event created: ${event.name} (${event.eventType})`,
  );

  const createdEvent: CommercialEventCreatedEvent = {
    eventId: event.id,
    tenantKey,
    ownerUserId: requesterId,
    eventType: event.eventType,
    name: event.name,
    timestamp: new Date(),
  };
  await eventBus.emit(COMMERCIAL_EVENT_EVENTS.EVENT_CREATED, createdEvent);

  return event;
}

export async function updateEvent(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  id: string,
  input: UpdateEventInput,
): Promise<CommercialEventSummary> {
  checkEventPermission(requesterRole, 'events:update');
  const event = await repo.updateEvent(tenantKey, id, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_updated',
      object_type: 'commercial_event',
      object_id: id,
      result: 'success',
    },
    `Commercial event updated: ${event.name}`,
  );

  const updatedEvent: CommercialEventUpdatedEvent = {
    eventId: id,
    tenantKey,
    changes: input as Record<string, unknown>,
    updatedBy: requesterId,
    timestamp: new Date(),
  };
  await eventBus.emit(COMMERCIAL_EVENT_EVENTS.EVENT_UPDATED, updatedEvent);

  return event;
}

export async function updateEventStrategy(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  id: string,
  input: UpdateStrategyInput,
): Promise<CommercialEventSummary> {
  checkEventPermission(requesterRole, 'events:update');
  const event = await repo.updateEventStrategy(tenantKey, id, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_strategy_updated',
      object_type: 'commercial_event',
      object_id: id,
      result: 'success',
    },
    `Commercial event strategy updated: ${event.name}`,
  );

  const strategyEvent: CommercialEventStrategyUpdatedEvent = {
    eventId: id,
    tenantKey,
    updatedBy: requesterId,
    timestamp: new Date(),
  };
  await eventBus.emit(COMMERCIAL_EVENT_EVENTS.EVENT_STRATEGY_UPDATED, strategyEvent);

  return event;
}

export async function transitionEvent(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  id: string,
  toStatus: CommercialEventStatus,
  reason?: string,
): Promise<CommercialEventSummary> {
  checkEventPermission(requesterRole, 'events:transition');

  const existing = await repo.getEventById(tenantKey, id);
  const fromStatus = existing.status;

  validateEventTransition(fromStatus, toStatus);

  const event = await repo.updateEventStatus(tenantKey, id, toStatus);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_status_changed',
      object_type: 'commercial_event',
      object_id: id,
      result: 'success',
    },
    `Commercial event status: ${fromStatus} -> ${toStatus}${reason ? ` (${reason})` : ''}`,
  );

  const statusEvent: CommercialEventStatusChangedEvent = {
    eventId: id,
    tenantKey,
    fromStatus,
    toStatus,
    changedBy: requesterId,
    reason,
    timestamp: new Date(),
  };
  await eventBus.emit(COMMERCIAL_EVENT_EVENTS.EVENT_STATUS_CHANGED, statusEvent);

  return event;
}

export async function linkCampaign(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  eventId: string,
  campaignId: string,
): Promise<void> {
  checkEventPermission(requesterRole, 'events:link');
  await repo.linkCampaign(tenantKey, eventId, campaignId);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_campaign_linked',
      object_type: 'commercial_event',
      object_id: eventId,
      result: 'success',
    },
    `Campaign ${campaignId} linked to event ${eventId}`,
  );

  const linkEvent: CommercialEventCampaignLinkedEvent = {
    eventId,
    campaignId,
    tenantKey,
    linkedBy: requesterId,
    timestamp: new Date(),
  };
  await eventBus.emit(COMMERCIAL_EVENT_EVENTS.EVENT_CAMPAIGN_LINKED, linkEvent);
}

export async function linkLead(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  eventId: string,
  leadId: string,
): Promise<void> {
  checkEventPermission(requesterRole, 'events:link');
  await repo.linkLead(tenantKey, eventId, leadId);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_lead_linked',
      object_type: 'commercial_event',
      object_id: eventId,
      result: 'success',
    },
    `Lead ${leadId} linked to event ${eventId}`,
  );

  const linkEvent: CommercialEventLeadLinkedEvent = {
    eventId,
    leadId,
    tenantKey,
    linkedBy: requesterId,
    timestamp: new Date(),
  };
  await eventBus.emit(COMMERCIAL_EVENT_EVENTS.EVENT_LEAD_LINKED, linkEvent);
}

export async function getEventDashboard(
  requesterRole: string,
  tenantKey: string,
  eventId: string,
): Promise<EventDashboardSummary> {
  checkEventPermission(requesterRole, 'events:read');
  return repo.getEventDashboard(tenantKey, eventId);
}

export async function listEventCampaigns(
  requesterRole: string,
  tenantKey: string,
  eventId: string,
) {
  checkEventPermission(requesterRole, 'events:read');
  return repo.listEventCampaigns(tenantKey, eventId);
}

export async function listEventLeads(
  requesterRole: string,
  tenantKey: string,
  eventId: string,
) {
  checkEventPermission(requesterRole, 'events:read');
  return repo.listEventLeads(tenantKey, eventId);
}

export async function createEventKpiRecord(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  eventId: string,
  input: CreateKpiRecordInput,
): Promise<EventKpiRecordSummary> {
  checkEventPermission(requesterRole, 'events:update');
  const record = await repo.createKpiRecord(tenantKey, eventId, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_kpi_record_created',
      object_type: 'event_kpi_record',
      object_id: record.id,
      result: 'success',
    },
    `Event KPI record created for event ${eventId}`,
  );

  return record;
}

export async function updateEventKpiRecord(
  requesterRole: string,
  tenantKey: string,
  requesterId: string,
  eventId: string,
  kpiId: string,
  input: UpdateKpiRecordInput,
): Promise<EventKpiRecordSummary> {
  checkEventPermission(requesterRole, 'events:update');
  const record = await repo.updateKpiRecord(tenantKey, eventId, kpiId, requesterId, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'commercial_event_kpi_record_updated',
      object_type: 'event_kpi_record',
      object_id: kpiId,
      result: 'success',
    },
    `Event KPI record updated for event ${eventId}`,
  );

  return record;
}
