import { describe, it, expect, vi } from 'vitest';
import { ForbiddenError } from '@shared/errors';

vi.mock('@shared/database', () => ({
  prisma: {
    commercialEvent: { findFirst: vi.fn().mockResolvedValue({ id: 'event-1', tenant_key: 'tenant-a' }) },
    eventEmailPlan: { findFirst: vi.fn().mockResolvedValue({ id: 'plan-1', tenant_key: 'tenant-a', event_id: 'event-1' }), update: vi.fn().mockResolvedValue({ id: 'plan-1', event_id: 'event-1' }) },
    eventWhatsappPlan: { findFirst: vi.fn().mockResolvedValue({ id: 'plan-1', tenant_key: 'tenant-a', event_id: 'event-1' }), update: vi.fn().mockResolvedValue({ id: 'plan-1', event_id: 'event-1' }) },
    eventUpsellPlan: { findFirst: vi.fn().mockResolvedValue({ id: 'plan-1', tenant_key: 'tenant-a', event_id: 'event-1' }), update: vi.fn().mockResolvedValue({ id: 'plan-1', event_id: 'event-1' }) },
  },
}));

vi.mock('@shared/logging', () => ({ auditLog: vi.fn() }));
vi.mock('@shared/events', () => ({ eventBus: { emit: vi.fn() } }));

import * as service from '../service';

describe('Approval bypass enforcement', () => {
  describe('roles that CAN approve', () => {
    const approverRoles = ['admin', 'cco', 'department_head', 'marketing_manager'];

    for (const role of approverRoles) {
      it(`${role} can set approvalStatus to approved`, async () => {
        await expect(
          service.updateEmailPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'approved' }),
        ).resolves.toBeDefined();
      });

      it(`${role} can set approvalStatus to rejected`, async () => {
        await expect(
          service.updateWhatsappPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'rejected' }),
        ).resolves.toBeDefined();
      });

      it(`${role} can set approvalStatus to changes_requested`, async () => {
        await expect(
          service.updateUpsellPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'changes_requested' }),
        ).resolves.toBeDefined();
      });

      it(`${role} can set approvalStatus to pending_review`, async () => {
        await expect(
          service.updateEmailPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'pending_review' }),
        ).resolves.toBeDefined();
      });
    }
  });

  describe('roles that CANNOT approve', () => {
    const nonApproverRoles = ['social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist'];

    for (const role of nonApproverRoles) {
      it(`${role} cannot set approvalStatus to approved`, async () => {
        await expect(
          service.updateEmailPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'approved' }),
        ).rejects.toThrow(ForbiddenError);
      });

      it(`${role} cannot set approvalStatus to rejected`, async () => {
        await expect(
          service.updateWhatsappPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'rejected' }),
        ).rejects.toThrow(ForbiddenError);
      });

      it(`${role} cannot set approvalStatus to changes_requested`, async () => {
        await expect(
          service.updateUpsellPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'changes_requested' }),
        ).rejects.toThrow(ForbiddenError);
      });

      it(`${role} cannot set approvalStatus to pending_review`, async () => {
        await expect(
          service.updateEmailPlan(role, 'tenant-a', 'user-1', 'plan-1', { approvalStatus: 'pending_review' }),
        ).rejects.toThrow(ForbiddenError);
      });
    }
  });

  describe('non-approval updates still work for update-allowed roles', () => {
    it('social_media_manager can update sequenceName without approval change', async () => {
      await expect(
        service.updateEmailPlan('social_media_manager', 'tenant-a', 'user-1', 'plan-1', { sequenceName: 'Updated' }),
      ).resolves.toBeDefined();
    });

    it('sales_manager can update messageDraft without approval change', async () => {
      await expect(
        service.updateWhatsappPlan('sales_manager', 'tenant-a', 'user-1', 'plan-1', { messageDraft: 'New message' }),
      ).resolves.toBeDefined();
    });

    it('specialist can update offer without approval change', async () => {
      await expect(
        service.updateUpsellPlan('specialist', 'tenant-a', 'user-1', 'plan-1', { offer: 'New offer' }),
      ).resolves.toBeDefined();
    });
  });
});
