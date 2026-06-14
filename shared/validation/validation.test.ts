import { describe, it, expect } from 'vitest';
import {
  emailSchema,
  uuidSchema,
  iso8601Schema,
  paginationSchema,
  validateOrThrow,
} from './index';
import { ValidationError } from '../errors';

describe('shared/validation', () => {
  describe('emailSchema', () => {
    it('accepts valid email', () => {
      expect(emailSchema.parse('user@example.com')).toBe('user@example.com');
    });

    it('rejects invalid email', () => {
      expect(() => emailSchema.parse('not-an-email')).toThrow();
    });
  });

  describe('uuidSchema', () => {
    it('accepts valid UUID', () => {
      expect(uuidSchema.parse('550e8400-e29b-41d4-a716-446655440000')).toBe(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('rejects invalid UUID', () => {
      expect(() => uuidSchema.parse('not-a-uuid')).toThrow();
    });
  });

  describe('iso8601Schema', () => {
    it('accepts valid ISO 8601 datetime', () => {
      expect(iso8601Schema.parse('2026-06-14T10:00:00Z')).toBe('2026-06-14T10:00:00Z');
    });

    it('rejects invalid datetime', () => {
      expect(() => iso8601Schema.parse('not-a-date')).toThrow();
    });
  });

  describe('paginationSchema', () => {
    it('defaults to page 1, limit 20', () => {
      const result = paginationSchema.parse({});
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('parses custom values', () => {
      const result = paginationSchema.parse({ page: '3', limit: '50' });
      expect(result.page).toBe(3);
      expect(result.limit).toBe(50);
    });

    it('rejects limit > 100', () => {
      expect(() => paginationSchema.parse({ limit: 101 })).toThrow();
    });
  });

  describe('validateOrThrow', () => {
    it('returns parsed data on success', () => {
      const result = validateOrThrow(emailSchema, 'test@example.com');
      expect(result).toBe('test@example.com');
    });

    it('throws ValidationError on failure', () => {
      expect(() => validateOrThrow(emailSchema, 'bad')).toThrow(ValidationError);
    });
  });
});
