import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn() },
  eventEmailPlan: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  eventWhatsappPlan: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  eventUpsellPlan: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  eventContentRequirement: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  eventSalesTask: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as repo from '../repository';

describe('Event Campaign Planner tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
  });

  it('lists email plans scoped to tenant and event', async () => {
    prismaMocks.eventEmailPlan.findMany.mockResolvedValue([]);
    await repo.listEmailPlans('tenant-a', 'event-1');
    expect(prismaMocks.eventEmailPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: 'event-1' },
    }));
  });

  it('lists whatsapp plans scoped to tenant and event', async () => {
    prismaMocks.eventWhatsappPlan.findMany.mockResolvedValue([]);
    await repo.listWhatsappPlans('tenant-a', 'event-1');
    expect(prismaMocks.eventWhatsappPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: 'event-1' },
    }));
  });

  it('lists upsell plans scoped to tenant and event', async () => {
    prismaMocks.eventUpsellPlan.findMany.mockResolvedValue([]);
    await repo.listUpsellPlans('tenant-a', 'event-1');
    expect(prismaMocks.eventUpsellPlan.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: 'event-1' },
    }));
  });

  it('lists content requirements scoped to tenant and event', async () => {
    prismaMocks.eventContentRequirement.findMany.mockResolvedValue([]);
    await repo.listContentRequirements('tenant-a', 'event-1');
    expect(prismaMocks.eventContentRequirement.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: 'event-1' },
    }));
  });

  it('lists sales tasks scoped to tenant and event', async () => {
    prismaMocks.eventSalesTask.findMany.mockResolvedValue([]);
    await repo.listSalesTasks('tenant-a', 'event-1');
    expect(prismaMocks.eventSalesTask.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a', event_id: 'event-1' },
    }));
  });

  it('verifies event ownership before creating email plan', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.createEmailPlan('tenant-a', 'user-1', {
      eventId: 'event-1',
      sequenceName: 'Test',
      emailCount: 1,
      contentType: 'text',
    })).rejects.toThrow();
  });

  it('verifies event ownership before creating whatsapp plan', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.createWhatsappPlan('tenant-a', 'user-1', {
      eventId: 'event-1',
      contentType: 'text',
    })).rejects.toThrow();
  });

  it('verifies event ownership before creating upsell plan', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.createUpsellPlan('tenant-a', 'user-1', {
      eventId: 'event-1',
    })).rejects.toThrow();
  });

  it('verifies event ownership before creating content requirement', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.createContentRequirement('tenant-a', 'user-1', {
      eventId: 'event-1',
      assetType: 'video',
    })).rejects.toThrow();
  });

  it('verifies event ownership before creating sales task', async () => {
    prismaMocks.commercialEvent.findFirst.mockResolvedValue(null);
    await expect(repo.createSalesTask('tenant-a', 'user-1', {
      eventId: 'event-1',
      taskType: 'follow_up',
    })).rejects.toThrow();
  });
});
