import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  contentRequest: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
  leadCaptureRecord: {
    findFirst: vi.fn(),
    update: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as eventRepo from '../repository';

describe('Commercial Events tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes tenant_key when creating an event', async () => {
    prismaMocks.commercialEvent.create.mockResolvedValue({
      id: 'event-1',
      tenant_key: 'tenant-a',
      name: 'Tagyeer wa Irtaqi — July 2026',
      event_type: 'tagyeer_wa_irtaqi',
      event_date: new Date('2026-07-15T18:00:00Z'),
      location: 'Riyadh',
      campaign_start_date: null,
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

    await eventRepo.createEvent('tenant-a', 'user-1', {
      name: 'Tagyeer wa Irtaqi — July 2026',
      eventType: 'tagyeer_wa_irtaqi',
      eventDate: '2026-07-15T18:00:00Z',
    });

    expect(prismaMocks.commercialEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('lists events only inside the requested tenant', async () => {
    prismaMocks.commercialEvent.findMany.mockResolvedValue([]);

    await eventRepo.listEvents('tenant-a');

    expect(prismaMocks.commercialEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('getEventById scopes to tenant', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);

    await expect(eventRepo.getEventById('tenant-a', 'event-1')).rejects.toThrow();
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', id: 'event-1' }),
    }));
  });

  it('linkCampaign verifies event belongs to tenant', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);

    await expect(eventRepo.linkCampaign('tenant-a', 'event-1', 'campaign-1')).rejects.toThrow();
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', id: 'event-1' }),
    }));
  });

  it('linkLead verifies event belongs to tenant', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);

    await expect(eventRepo.linkLead('tenant-a', 'event-1', 'lead-1')).rejects.toThrow();
    expect(prismaMocks.commercialEvent.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', id: 'event-1' }),
    }));
  });
});
