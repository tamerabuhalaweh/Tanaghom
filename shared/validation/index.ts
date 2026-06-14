import { z } from 'zod';
import { ValidationError } from '../errors';

export const emailSchema = z.string().email('Invalid email format');

export const uuidSchema = z.string().uuid('Invalid UUID format');

export const iso8601Schema = z.string().datetime('Invalid ISO 8601 datetime');

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

export function validateOrThrow<T>(schema: z.ZodSchema<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join('.');
      fields[path || '_root'] = issue.message;
    }
    throw new ValidationError('Validation failed', fields);
  }
  return result.data;
}
