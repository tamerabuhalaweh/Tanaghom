import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ForbiddenError } from '@shared/errors';

const prismaMocks = vi.hoisted(() => ({
  commercialEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' }) },
  leadCaptureRecord: { findFirst: vi.fn() },
  contentRequest: { findFirst: vi.fn() },
  eventProblem: {
    findFirst: vi.fn(),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', title: 'Test', category: 'content', severity: 'medium', status: 'open', source: 'manual', created_by_user_id: 'user-1', created_at: new Date(), updated_at: new Date() }),
    update: vi.fn().mockResolvedValue({ id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', title: 'Updated', category: 'content', severity: 'medium', status: 'open', source: 'manual', created_by_user_id: 'user-1', created_at: new Date(), updated_at: new Date() }),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));
vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));
vi.mock('@shared/events', () => ({ eventBus: { emit: vi.fn() } }));

import * as service from '../service';

describe('Runtime category RBAC enforcement on update', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
    prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue({ id: 'lead-1', tenant_key: 'tenant-a' });
    prismaMocks.contentRequest.findFirst.mockResolvedValue({ id: 'camp-1', tenant_key: 'tenant-a' });
  });

  describe('social_media_manager', () => {
    it('cannot update existing sales problem when category is omitted', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'sales', status: 'open',
      });
      await expect(
        service.updateProblem('social_media_manager', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('cannot update existing integration problem when category is omitted', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'integration', status: 'open',
      });
      await expect(
        service.updateProblem('social_media_manager', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('can update existing content problem when category is omitted', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'content', status: 'open', title: 'Old', created_at: new Date(), updated_at: new Date(),
      });
      await expect(
        service.updateProblem('social_media_manager', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).resolves.toBeDefined();
    });
  });

  describe('sales_manager', () => {
    it('cannot update existing content problem when category is omitted', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'content', status: 'open',
      });
      await expect(
        service.updateProblem('sales_manager', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('cannot update existing ads problem when category is omitted', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'ads', status: 'open',
      });
      await expect(
        service.updateProblem('sales_manager', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).rejects.toThrow(ForbiddenError);
    });

    it('can update existing sales problem when category is omitted', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'sales', status: 'open', title: 'Old', created_at: new Date(), updated_at: new Date(),
      });
      await expect(
        service.updateProblem('sales_manager', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).resolves.toBeDefined();
    });
  });

  describe('allowed category updates', () => {
    it('admin can update any problem regardless of category', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'integration', status: 'open', title: 'Old', created_at: new Date(), updated_at: new Date(),
      });
      await expect(
        service.updateProblem('admin', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).resolves.toBeDefined();
    });

    it('social_media_manager can update ads problem', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'ads', status: 'open', title: 'Old', created_at: new Date(), updated_at: new Date(),
      });
      await expect(
        service.updateProblem('social_media_manager', 'tenant-a', 'user-1', 'p1', { title: 'Updated' }),
      ).resolves.toBeDefined();
    });
  });
});

describe('Related entity ownership validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.commercialEvent.findFirst.mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' });
  });

  describe('createProblem', () => {
    it('rejects lead from different tenant', async () => {
      prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
      await expect(
        service.createProblem('admin', 'tenant-a', 'user-1', {
          eventId: 'event-1', title: 'Test', category: 'sales', relatedLeadId: 'lead-other-tenant',
        }),
      ).rejects.toThrow();
    });

    it('rejects campaign from different tenant', async () => {
      prismaMocks.contentRequest.findFirst.mockResolvedValue(null);
      await expect(
        service.createProblem('admin', 'tenant-a', 'user-1', {
          eventId: 'event-1', title: 'Test', category: 'sales', relatedCampaignId: 'camp-other-tenant',
        }),
      ).rejects.toThrow();
    });

    it('accepts valid lead and campaign from same tenant', async () => {
      prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue({ id: 'lead-1', tenant_key: 'tenant-a' });
      prismaMocks.contentRequest.findFirst.mockResolvedValue({ id: 'camp-1', tenant_key: 'tenant-a' });
      await expect(
        service.createProblem('admin', 'tenant-a', 'user-1', {
          eventId: 'event-1', title: 'Test', category: 'sales',
          relatedLeadId: 'lead-1', relatedCampaignId: 'camp-1',
        }),
      ).resolves.toBeDefined();
    });
  });

  describe('updateProblem', () => {
    it('rejects lead from different tenant on update', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'sales', status: 'open',
      });
      prismaMocks.leadCaptureRecord.findFirst.mockResolvedValue(null);
      await expect(
        service.updateProblem('admin', 'tenant-a', 'user-1', 'p1', { relatedLeadId: 'lead-other' }),
      ).rejects.toThrow();
    });

    it('rejects campaign from different tenant on update', async () => {
      prismaMocks.eventProblem.findFirst.mockResolvedValue({
        id: 'p1', tenant_key: 'tenant-a', event_id: 'event-1', category: 'sales', status: 'open',
      });
      prismaMocks.contentRequest.findFirst.mockResolvedValue(null);
      await expect(
        service.updateProblem('admin', 'tenant-a', 'user-1', 'p1', { relatedCampaignId: 'camp-other' }),
      ).rejects.toThrow();
    });
  });
});
