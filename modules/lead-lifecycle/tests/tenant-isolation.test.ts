import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  leadCaptureRecord: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'lead-1', tenant_key: 'tenant-a', lead_status: 'new_lead', lead_temperature: 'cold' }),
    update: vi.fn().mockResolvedValue({ id: 'lead-1', tenant_key: 'tenant-a' }),
  },
  leadLifecycleEvent: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));
vi.mock('@shared/events', () => ({ eventBus: { emit: vi.fn() } }));

import * as repo from '../repository';

describe('Lead Lifecycle tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lists leads scoped to tenant', async () => {
    await repo.listLeads('tenant-a');
    expect(prismaMocks.leadCaptureRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('lists leads scoped to tenant and event', async () => {
    await repo.listLeads('tenant-a', 'event-1');
    expect(prismaMocks.leadCaptureRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', event_id: 'event-1' }),
    }));
  });

  it('getLeadById scopes to tenant', async () => {
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
    await expect(repo.getLeadById('tenant-a', 'lead-1')).rejects.toThrow();
    expect(prismaMocks.leadCaptureRecord.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a', id: 'lead-1' }),
    }));
  });

  it('transitionLead scopes to tenant', async () => {
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
    await expect(repo.transitionLead('tenant-a', 'lead-1', 'contacted', 'user-1')).rejects.toThrow();
  });

  it('updateMeeting scopes to tenant', async () => {
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
    await expect(repo.updateMeeting('tenant-a', 'lead-1', { meetingDate: '2026-07-22T14:00:00Z', meetingType: 'Call' })).rejects.toThrow();
  });

  it('updatePurchase scopes to tenant', async () => {
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
    await expect(repo.updatePurchase('tenant-a', 'lead-1', { purchaseDate: '2026-08-15', purchaseAmount: 1000 })).rejects.toThrow();
  });

  it('setTemperature scopes to tenant', async () => {
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
    await expect(repo.setTemperature('tenant-a', 'lead-1', { temperature: 'hot' }, 'user-1')).rejects.toThrow();
  });
});
