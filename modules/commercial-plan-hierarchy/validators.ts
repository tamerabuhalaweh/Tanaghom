import {
  archiveExecutionLinkSchema,
  archiveLearningSchema,
  assignPlanSchema,
  linkCampaignSchema,
  linkEventSchema,
  linkLearningSchema,
  supersedePlanSchema,
  unlinkParentSchema,
} from './types';

export const validateAssignPlan = (input: unknown) => assignPlanSchema.parse(input);
export const validateUnlinkParent = (input: unknown) => unlinkParentSchema.parse(input);
export const validateLinkEvent = (input: unknown) => linkEventSchema.parse(input);
export const validateLinkCampaign = (input: unknown) => linkCampaignSchema.parse(input);
export const validateArchiveExecutionLink = (input: unknown) => archiveExecutionLinkSchema.parse(input);
export const validateLinkLearning = (input: unknown) => linkLearningSchema.parse(input);
export const validateArchiveLearning = (input: unknown) => archiveLearningSchema.parse(input);
export const validateSupersedePlan = (input: unknown) => supersedePlanSchema.parse(input);
