import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: {
    create: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as eventRepo from '../repository';

describe('Commercial Events campaign date auto-derivation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.commercialEvent.create.mockResolvedValue({
      id: 'event-1',
      tenant_key: 'tenant-a',
      name: 'Test Event',
      event_type: 'tagyeer_wa_irtaqi',
      event_date: new Date('2026-08-15T18:00:00Z'),
      location: 'Riyadh',
      campaign_start_date: new Date('2026-07-16T18:00:00Z'),
      campaign_end_date: null,
      expected_attendance: 150,
      revenue_target: 75000,
      planned_budget: 20000,
      owner_user_id: 'user-1',
      status: 'draft',
      offer: null,
      audience: null,
      geography: null,
      fomo_angle: null,
      upsell_plan: null,
      selected_channels: [],
      content_department_requirements: null,
      sales_team_requirements: null,
      created_at: new Date(),
      updated_at: new Date(),
      owner: { name: 'Amro' },
      campaigns: [],
      leads: [],
    });
  });

  it('auto-derives campaignStartDate as 30 days before eventDate when not provided', async () => {
    await eventRepo.createEvent('tenant-a', 'user-1', {
      name: 'Test Event',
      eventType: 'tagyeer_wa_irtaqi',
      eventDate: '2026-08-15T18:00:00Z',
    });

    const createCall = prismaMocks.commercialEvent.create.mock.calls[0][0];
    const campaignStart = createCall.data.campaign_start_date;
    const eventDate = createCall.data.event_date;

    // Campaign start should be 30 days before event
    const diffMs = eventDate.getTime() - campaignStart.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
    expect(diffDays).toBe(30);
  });

  it('uses provided campaignStartDate when given', async () => {
    await eventRepo.createEvent('tenant-a', 'user-1', {
      name: 'Test Event',
      eventType: 'tagyeer_wa_irtaqi',
      eventDate: '2026-08-15T18:00:00Z',
      campaignStartDate: '2026-07-01T00:00:00Z',
    });

    const createCall = prismaMocks.commercialEvent.create.mock.calls[0][0];
    expect(createCall.data.campaign_start_date).toEqual(new Date('2026-07-01T00:00:00Z'));
  });

  it('corrects campaignStartDate if it is after eventDate', async () => {
    await eventRepo.createEvent('tenant-a', 'user-1', {
      name: 'Test Event',
      eventType: 'tagyeer_wa_irtaqi',
      eventDate: '2026-08-15T18:00:00Z',
      campaignStartDate: '2026-09-01T00:00:00Z', // after event
    });

    const createCall = prismaMocks.commercialEvent.create.mock.calls[0][0];
    const campaignStart = createCall.data.campaign_start_date;
    const eventDate = createCall.data.event_date;

    // Should be corrected to 30 days before event
    expect(campaignStart.getTime()).toBeLessThan(eventDate.getTime());
  });

  it('sets campaignEndDate to eventDate if provided end date is before start date', async () => {
    await eventRepo.createEvent('tenant-a', 'user-1', {
      name: 'Test Event',
      eventType: 'tagyeer_wa_irtaqi',
      eventDate: '2026-08-15T18:00:00Z',
      campaignStartDate: '2026-07-01T00:00:00Z',
      campaignEndDate: '2026-06-01T00:00:00Z', // before start
    });

    const createCall = prismaMocks.commercialEvent.create.mock.calls[0][0];
    // Should fall back to eventDate
    expect(createCall.data.campaign_end_date).toEqual(new Date('2026-08-15T18:00:00Z'));
  });
});
