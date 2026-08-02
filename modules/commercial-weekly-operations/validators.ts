import type { z } from 'zod';
import {
  createWeeklyWorkItemSchema,
  transitionWeeklyWorkItemSchema,
  updateWeeklyWorkItemSchema,
  weeklyWorkspaceQuerySchema,
} from './types';

function parse<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  return schema.parse(input);
}

export const validateWeeklyWorkspaceQuery = (input: unknown) => parse(weeklyWorkspaceQuerySchema, input);
export const validateCreateWeeklyWorkItem = (input: unknown) => parse(createWeeklyWorkItemSchema, input);
export const validateUpdateWeeklyWorkItem = (input: unknown) => parse(updateWeeklyWorkItemSchema, input);
export const validateTransitionWeeklyWorkItem = (input: unknown) => parse(transitionWeeklyWorkItemSchema, input);
