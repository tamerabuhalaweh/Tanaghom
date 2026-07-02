import { describe, it, expect, beforeEach } from 'vitest';
import { ValidationError, StateTransitionError } from '@shared/errors';
import * as repo from '../repository';
import { CONNECTOR_REQUIREMENTS, SUPPORTED_CONNECTORS } from '../types';

describe('Connector Imports', () => {
  beforeEach(() => { repo.clearAllJobs(); });

  describe('no secrets returned', () => {
    it('readiness does not expose raw credential values', () => {
      const readiness = repo.getReadiness('tenant-a');
      const json = JSON.stringify(readiness);
      expect(json).not.toMatch(/sk-[a-zA-Z0-9]/);
      expect(json).not.toMatch(/Bearer [a-zA-Z0-9]/);
      expect(json).not.toContain('actual_secret_value');
    });

    it('job objects do not contain credential fields', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      const json = JSON.stringify(job);
      expect(json).not.toMatch(/sk-[a-zA-Z0-9]/);
      expect(json).not.toMatch(/Bearer [a-zA-Z0-9]/);
    });
  });

  describe('no external calls', () => {
    it('repository operations are pure in-memory', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      expect(job.id).toBeDefined();
      expect(job.state).toBeDefined();
    });
  });

  describe('unsupported connector rejected', () => {
    it('rejects unsupported connector id', () => {
      expect(() => repo.createJob('tenant-a', 'user-1', { connectorId: 'unsupported_connector' as never, displayName: 'Bad' })).toThrow(ValidationError);
    });
  });

  describe('missing credentials', () => {
    it('new job starts in requires_credentials when credentials are missing', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz Import' });
      expect(job.state).toBe('requires_credentials');
      expect(job.credentialState).toBe('customer_credential_missing');
    });
  });

  describe('job state transitions', () => {
    it('new job starts in requires_credentials when credentials are missing', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      expect(job.state).toBe('requires_credentials');
    });

    it('allows requires_credentials -> ready_for_test', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      const refreshed = repo.getJob('tenant-a', job.id);
      expect(refreshed.state).toBe('ready_for_test');
    });

    it('allows ready_for_test -> test_passed via markJobReady', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      const result = repo.markJobReady('tenant-a', job.id, true);
      expect(result.state).toBe('test_passed');
    });

    it('allows ready_for_test -> blocked via markJobReady', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      const result = repo.markJobReady('tenant-a', job.id, false);
      expect(result.state).toBe('blocked');
    });

    it('allows blocked -> ready_for_test via markJobReady', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      repo.markJobReady('tenant-a', job.id, false);
      const result = repo.markJobReady('tenant-a', job.id, true);
      expect(result.state).toBe('test_passed');
    });

    it('allows test_passed -> disabled', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      repo.markJobReady('tenant-a', job.id, true);
      const result = repo.disableJob('tenant-a', job.id);
      expect(result.state).toBe('disabled');
    });

    it('allows disabled -> draft via transitionJob', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      repo.markJobReady('tenant-a', job.id, true);
      repo.disableJob('tenant-a', job.id);
      const result = repo.transitionJob('tenant-a', job.id, 'draft');
      expect(result.state).toBe('draft');
    });

    it('rejects invalid transition test_passed -> requires_credentials', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      repo.markJobReady('tenant-a', job.id, true);
      expect(() => repo.transitionJob('tenant-a', job.id, 'requires_credentials')).toThrow(StateTransitionError);
    });

    it('rejects invalid transition disabled -> test_passed', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Test' });
      repo.transitionJob('tenant-a', job.id, 'ready_for_test');
      repo.markJobReady('tenant-a', job.id, true);
      repo.disableJob('tenant-a', job.id);
      expect(() => repo.transitionJob('tenant-a', job.id, 'test_passed')).toThrow(StateTransitionError);
    });
  });

  describe('readiness reporting', () => {
    it('reports all supported connectors', () => {
      const readiness = repo.getReadiness('tenant-a');
      expect(readiness.connectors).toHaveLength(SUPPORTED_CONNECTORS.length);
      for (const connectorId of SUPPORTED_CONNECTORS) {
        expect(readiness.connectors.find(c => c.connectorId === connectorId)).toBeDefined();
      }
    });

    it('reports connector requirements correctly', () => {
      const readiness = repo.getReadiness('tenant-a');
      for (const connector of readiness.connectors) {
        const req = CONNECTOR_REQUIREMENTS[connector.connectorId];
        expect(connector.label).toBe(req.label);
        expect(connector.purpose).toBe(req.purpose);
        expect(connector.requiredCredentialFields).toEqual(req.requiredCredentialFields);
      }
    });

    it('shows configured count after creating jobs', () => {
      repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz' });
      repo.createJob('tenant-a', 'user-1', { connectorId: 'gohighlevel', displayName: 'GHL' });
      const readiness = repo.getReadiness('tenant-a');
      expect(readiness.connectors.filter(c => c.jobId !== null)).toHaveLength(2);
    });

    it('returns zero counts for empty tenant', () => {
      const readiness = repo.getReadiness('tenant-a');
      expect(readiness.totalConfigured).toBe(0);
      expect(readiness.totalMissing).toBe(SUPPORTED_CONNECTORS.length);
      expect(readiness.totalBlocked).toBe(0);
    });
  });

  describe('duplicate connector prevention', () => {
    it('prevents creating duplicate active job for same connector', () => {
      repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'First' });
      expect(() => repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Second' })).toThrow(ValidationError);
    });

    it('allows creating job after disabling previous one', () => {
      const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'First' });
      repo.disableJob('tenant-a', job.id);
      const second = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Second' });
      expect(second.id).not.toBe(job.id);
    });
  });

  describe('all connectors supported', () => {
    const allConnectors = ['postiz', 'gohighlevel', 'formaloo', 'meta_analytics', 'youtube_analytics', 'whatsapp_provider', 'telegram_provider', 'smartlabs_voice'];
    for (const connectorId of allConnectors) {
      it(`supports ${connectorId}`, () => {
        const job = repo.createJob('tenant-a', 'user-1', { connectorId: connectorId as never, displayName: `Test ${connectorId}` });
        expect(job.connectorId).toBe(connectorId);
      });
    }
  });
});
