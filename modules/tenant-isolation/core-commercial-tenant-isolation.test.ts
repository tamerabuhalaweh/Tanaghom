import { beforeEach, describe, expect, it, vi } from 'vitest';

const prismaMocks = vi.hoisted(() => ({
  department: {
    findUnique: vi.fn(),
  },
  contentRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  approval: {
    findMany: vi.fn(),
  },
  publishingPackage: {
    findMany: vi.fn(),
  },
  leadCaptureRecord: {
    create: vi.fn(),
    findMany: vi.fn(),
  },
  analyticsSnapshot: {
    findMany: vi.fn(),
  },
  campaignPerformanceReport: {
    findMany: vi.fn(),
  },
  publishingExecutionRequest: {
    findMany: vi.fn(),
  },
}));

vi.mock('@shared/database', () => ({ prisma: prismaMocks }));

import * as campaignRepo from '../campaigns/repository';
import * as approvalRepo from '../approvals/repository';
import * as publishingPrepRepo from '../publishing-preparation/repository';
import * as crmRepo from '../crm-conversion/repository';
import * as analyticsRepo from '../analytics-reporting/repository';
import * as postizRepo from '../postiz-integration/repository';

describe('core Commercial/Social tenant isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    prismaMocks.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    prismaMocks.contentRequest.findMany.mockResolvedValue([]);
    prismaMocks.approval.findMany.mockResolvedValue([]);
    prismaMocks.publishingPackage.findMany.mockResolvedValue([]);
    prismaMocks.leadCaptureRecord.findMany.mockResolvedValue([]);
    prismaMocks.analyticsSnapshot.findMany.mockResolvedValue([]);
    prismaMocks.campaignPerformanceReport.findMany.mockResolvedValue([]);
    prismaMocks.publishingExecutionRequest.findMany.mockResolvedValue([]);
  });

  it('writes tenant_key when creating a campaign', async () => {
    prismaMocks.contentRequest.create.mockResolvedValue({
      id: 'campaign-1',
      tenant_key: 'tenant-a',
      requester_id: 'user-1',
      requester: { name: 'Marketing Manager' },
      channel: 'api',
      raw_message: 'Launch campaign',
      objective: 'Generate leads',
      audience: 'CEOs',
      target_platforms: ['linkedin'],
      deadline: null,
      cta: 'Book a call',
      media_refs: null,
      owner_department_id: 'dept-1',
      content_type: 'campaign',
      risk_category: 'low',
      status: 'idea',
      created_at: new Date('2026-06-29T00:00:00Z'),
      updated_at: new Date('2026-06-29T00:00:00Z'),
    });

    await campaignRepo.createCampaign('tenant-a', 'user-1', 'api', {
      topic: 'Launch campaign',
      objective: 'Generate leads',
      audience: 'CEOs',
      targetPlatforms: ['linkedin'],
      contentType: 'campaign',
      riskCategory: 'low',
      ownerDepartmentId: 'dept-1',
      cta: 'Book a call',
    });

    expect(prismaMocks.contentRequest.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('lists campaigns only inside the requested tenant', async () => {
    await campaignRepo.listCampaigns('tenant-a');

    expect(prismaMocks.contentRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { tenant_key: 'tenant-a' },
    }));
  });

  it('lists approvals and packages only inside the requested tenant', async () => {
    await approvalRepo.listApprovals({ tenantKey: 'tenant-a', approvalStatus: 'pending' });
    await publishingPrepRepo.listPackages({ tenantKey: 'tenant-a', packageStatus: 'draft' });

    expect(prismaMocks.approval.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
    expect(prismaMocks.publishingPackage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('writes and lists lead capture records with tenant ownership', async () => {
    prismaMocks.leadCaptureRecord.create.mockResolvedValue({
      id: 'lead-1',
      tenant_key: 'tenant-a',
      lead_status: 'new_lead',
      lead_source: 'linkedin',
      campaign_id: null,
      content_item_id: null,
      publishing_package_id: null,
      analytics_snapshot_id: null,
      platform: 'linkedin',
      source_url_placeholder: null,
      contact_reference_placeholder: null,
      lead_name_placeholder: 'A CEO',
      lead_phone_placeholder: null,
      lead_email_placeholder: null,
      consent_status: 'pending',
      created_by_user_id: 'user-1',
      created_by_agent_rep_id: 'agent-1',
      created_at: new Date('2026-06-29T00:00:00Z'),
      updated_at: new Date('2026-06-29T00:00:00Z'),
    });

    await crmRepo.createLeadCaptureRecord({
      leadSource: 'linkedin',
      platform: 'linkedin',
      leadNamePlaceholder: 'A CEO',
      consentStatus: 'pending',
      createdByUserId: 'user-1',
      createdByAgentRepId: 'agent-1',
    }, 'tenant-a');
    await crmRepo.listLeadCaptureRecords({ tenantKey: 'tenant-a', platform: 'linkedin' });

    expect(prismaMocks.leadCaptureRecord.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
    expect(prismaMocks.leadCaptureRecord.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('lists analytics snapshots and reports only inside the requested tenant', async () => {
    await analyticsRepo.listSnapshots({ tenantKey: 'tenant-a', platform: 'linkedin' });
    await analyticsRepo.listPerformanceReports({ tenantKey: 'tenant-a', campaignId: 'campaign-1' });

    expect(prismaMocks.analyticsSnapshot.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
    expect(prismaMocks.campaignPerformanceReport.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ tenant_key: 'tenant-a' }),
    }));
  });

  it('limits Postiz execution requests to tenant-owned publishing packages', async () => {
    prismaMocks.publishingPackage.findMany.mockResolvedValue([{ id: 'package-1' }, { id: 'package-2' }]);

    await postizRepo.listExecutionRequests({ tenantKey: 'tenant-a', requestStatus: 'ready' });

    expect(prismaMocks.publishingExecutionRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        publishing_package_id: { in: ['package-1', 'package-2'] },
        request_status: 'ready',
      }),
    }));
  });
});
