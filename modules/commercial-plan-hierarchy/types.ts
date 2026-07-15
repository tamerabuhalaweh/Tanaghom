import { z } from 'zod';

const uuid = z.string().uuid();
const reason = z.string().trim().min(3).max(2000);

export const assignPlanSchema = z.object({
  annualPlanId: uuid,
  monthlyPortfolioItemId: uuid,
});

export const unlinkParentSchema = z.object({ reason });

export const linkEventSchema = z.object({
  eventId: uuid,
  primary: z.boolean().default(false),
  periodExceptionReason: reason.optional(),
});

export const linkCampaignSchema = z.object({
  campaignId: uuid,
  periodExceptionReason: reason.optional(),
});

export const archiveExecutionLinkSchema = z.object({ reason });

export const linkLearningSchema = z.object({
  learningSetId: uuid,
  findingIds: z.array(uuid).min(1).max(50).refine((ids) => new Set(ids).size === ids.length, {
    message: 'Finding ids must be unique',
  }),
  rationale: z.string().trim().min(3).max(4000).optional(),
});

export const archiveLearningSchema = z.object({ reason });

export const supersedePlanSchema = z.object({
  replacementPlanId: uuid,
  reason,
});

export type AssignPlanInput = z.infer<typeof assignPlanSchema>;
export type UnlinkParentInput = z.infer<typeof unlinkParentSchema>;
export type LinkEventInput = z.infer<typeof linkEventSchema>;
export type LinkCampaignInput = z.infer<typeof linkCampaignSchema>;
export type ArchiveExecutionLinkInput = z.infer<typeof archiveExecutionLinkSchema>;
export type LinkLearningInput = z.infer<typeof linkLearningSchema>;
export type ArchiveLearningInput = z.infer<typeof archiveLearningSchema>;
export type SupersedePlanInput = z.infer<typeof supersedePlanSchema>;

export type HierarchyPermission =
  | 'commercial-hierarchy:read'
  | 'commercial-hierarchy:manage'
  | 'commercial-hierarchy:approve-exception';
