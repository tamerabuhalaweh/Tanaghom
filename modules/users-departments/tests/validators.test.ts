import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { validateCreateUser, validateUpdateUser, validateCreateDepartment, validateUpdateDepartment } from '../validators';
import { ValidationError } from '@shared/errors';

describe('users-departments/validators', () => {
  describe('createUser', () => {
    it('accepts valid input', () => {
      const result = validateCreateUser({
        email: 'new@example.com',
        name: 'New User',
        password: 'securepass123',
        role: 'specialist',
      });
      expect(result.email).toBe('new@example.com');
      expect(result.role).toBe('specialist');
    });

    it('accepts with optional departmentId', () => {
      const result = validateCreateUser({
        email: 'new@example.com',
        name: 'New User',
        password: 'securepass123',
        role: 'reviewer',
        departmentId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.departmentId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('rejects invalid role', () => {
      expect(() => validateCreateUser({
        email: 'new@example.com',
        name: 'New User',
        password: 'securepass123',
        role: 'superadmin',
      })).toThrow(ValidationError);
    });

    it('rejects short password', () => {
      expect(() => validateCreateUser({
        email: 'new@example.com',
        name: 'New User',
        password: 'short',
        role: 'viewer',
      })).toThrow(ValidationError);
    });

    it('rejects invalid email', () => {
      expect(() => validateCreateUser({
        email: 'not-an-email',
        name: 'New User',
        password: 'securepass123',
        role: 'viewer',
      })).toThrow(ValidationError);
    });
  });

  describe('updateUser', () => {
    it('accepts partial update', () => {
      const result = validateUpdateUser({ name: 'Updated Name' });
      expect(result.name).toBe('Updated Name');
    });

    it('accepts role change', () => {
      const result = validateUpdateUser({ role: 'admin' });
      expect(result.role).toBe('admin');
    });

    it('accepts isActive change', () => {
      const result = validateUpdateUser({ isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('rejects invalid role', () => {
      expect(() => validateUpdateUser({ role: 'invalid' })).toThrow(ValidationError);
    });
  });

  describe('createDepartment', () => {
    it('accepts valid input', () => {
      const result = validateCreateDepartment({ name: 'New Dept', description: 'A new department' });
      expect(result.name).toBe('New Dept');
    });

    it('rejects empty name', () => {
      expect(() => validateCreateDepartment({ name: '' })).toThrow(ValidationError);
    });
  });

  describe('updateDepartment', () => {
    it('accepts partial update', () => {
      const result = validateUpdateDepartment({ description: 'Updated description' });
      expect(result.description).toBe('Updated description');
    });
  });
});
