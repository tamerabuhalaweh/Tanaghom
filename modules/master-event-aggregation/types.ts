import { z } from 'zod';
import { COMMERCIAL_EVENT_STATUSES, COMMERCIAL_EVENT_TYPES } from '../commercial-events/types';

export const MASTER_DASHBOARD_FILTER_SCHEMA = z.object({
  eventType: z.enum(COMMERCIAL_EVENT_TYPES).optional(),
  eventStatus: z.enum(COMMERCIAL_EVENT_STATUSES).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  geography: z.string().optional(),
  ownerUserId: z.string().uuid().optional(),
});

export type MasterDashboardFilters = z.infer<typeof MASTER_DASHBOARD_FILTER_SCHEMA>;

export interface EventComparisonRow {
  eventId: string;
  eventName: string;
  eventType: string;
  eventDate: Date;
  status: string;
  geography: string | null;
  ownerName: string | null;
  totalLeads: number;
  formCompletions: number;
  meetingsBooked: number;
  meetingsAttended: number;
  noShows: number;
  noShowRate: number;
  purchases: number;
  revenue: number;
  revenueTarget: number | null;
  plannedBudget: number | null;
  actualSpend: number;
  costPerLead: number;
  bestChannel: string | null;
  bestAudienceSource: string | null;
}

export interface MasterDashboardSummary {
  totalEvents: number;
  filteredEvents: number;
  totals: {
    totalLeads: number;
    formCompletions: number;
    meetingsBooked: number;
    meetingsAttended: number;
    noShows: number;
    noShowRate: number;
    purchases: number;
    revenue: number;
    revenueTarget: number;
    plannedBudget: number;
    actualSpend: number;
    costPerLead: number;
  };
  byEventType: Record<string, { events: number; leads: number; purchases: number; revenue: number }>;
  byStatus: Record<string, number>;
  byGeography: Record<string, { events: number; leads: number; revenue: number }>;
  byChannel: Record<string, { leads: number; purchases: number; spend: number }>;
  byAudienceSource: Record<string, { leads: number; purchases: number }>;
  bestPerforming: {
    bestChannel: string | null;
    bestAudienceSource: string | null;
    highestRevenueEvent: { eventId: string; eventName: string; revenue: number } | null;
    lowestCostPerLeadEvent: { eventId: string; eventName: string; costPerLead: number } | null;
  };
  events: EventComparisonRow[];
}
