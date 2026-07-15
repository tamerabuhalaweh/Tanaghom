import { checkHierarchyPermission, canApproveHierarchyException } from './policy';
import * as repo from './repository';
import type {
  ArchiveExecutionLinkInput,
  ArchiveLearningInput,
  AssignPlanInput,
  LinkCampaignInput,
  LinkEventInput,
  LinkLearningInput,
  SupersedePlanInput,
  UnlinkParentInput,
} from './types';

export function getPlanHierarchy(role: string, tenantKey: string, planId: string) {
  checkHierarchyPermission(role, 'commercial-hierarchy:read');
  return repo.getPlanHierarchy(tenantKey, planId);
}

export function getAnnualHierarchy(role: string, tenantKey: string, annualPlanId: string) {
  checkHierarchyPermission(role, 'commercial-hierarchy:read');
  return repo.getAnnualHierarchy(tenantKey, annualPlanId);
}

export function getEventHierarchy(role: string, tenantKey: string, eventId: string) {
  checkHierarchyPermission(role, 'commercial-hierarchy:read');
  return repo.getEventHierarchy(tenantKey, eventId);
}

export function getCampaignHierarchy(role: string, tenantKey: string, campaignId: string) {
  checkHierarchyPermission(role, 'commercial-hierarchy:read');
  return repo.getCampaignHierarchy(tenantKey, campaignId);
}

export function getLearningHierarchy(role: string, tenantKey: string, learningSetId: string) {
  checkHierarchyPermission(role, 'commercial-hierarchy:read');
  return repo.getLearningHierarchy(tenantKey, learningSetId);
}

export function listOrphanPlans(role: string, tenantKey: string) {
  checkHierarchyPermission(role, 'commercial-hierarchy:read');
  return repo.listOrphanPlans(tenantKey);
}

export function assignPlan(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  input: AssignPlanInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  return repo.assignPlan(tenantKey, userId, planId, input);
}

export function unlinkParent(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  input: UnlinkParentInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  return repo.unlinkParent(tenantKey, userId, planId, input);
}

export function linkEvent(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  input: LinkEventInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  if (input.periodExceptionReason) {
    checkHierarchyPermission(role, 'commercial-hierarchy:approve-exception');
  }
  return repo.linkEvent(
    tenantKey,
    userId,
    input.periodExceptionReason && canApproveHierarchyException(role) ? userId : null,
    planId,
    input,
  );
}

export function archiveEventLink(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  eventId: string,
  input: ArchiveExecutionLinkInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  return repo.archiveEventLink(tenantKey, userId, planId, eventId, input);
}

export function linkCampaign(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  input: LinkCampaignInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  if (input.periodExceptionReason) {
    checkHierarchyPermission(role, 'commercial-hierarchy:approve-exception');
  }
  return repo.linkCampaign(
    tenantKey,
    userId,
    input.periodExceptionReason && canApproveHierarchyException(role) ? userId : null,
    planId,
    input,
  );
}

export function archiveCampaignLink(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  campaignId: string,
  input: ArchiveExecutionLinkInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  return repo.archiveCampaignLink(tenantKey, userId, planId, campaignId, input);
}

export function linkLearning(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  input: LinkLearningInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  return repo.linkLearning(tenantKey, userId, planId, input);
}

export function archiveLearning(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  findingId: string,
  input: ArchiveLearningInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  return repo.archiveLearning(tenantKey, userId, planId, findingId, input);
}

export function supersedePlan(
  role: string,
  tenantKey: string,
  userId: string,
  planId: string,
  input: SupersedePlanInput,
) {
  checkHierarchyPermission(role, 'commercial-hierarchy:manage');
  return repo.supersedePlan(tenantKey, userId, planId, input);
}
