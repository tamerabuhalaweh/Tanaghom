import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundError } from '@shared/errors';
import * as repo from '../repository';

describe('Connector Imports tenant isolation', () => {
  beforeEach(() => { repo.clearAllJobs(); });

  it('rejects cross-tenant job access', () => {
    const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz Import' });
    expect(() => repo.getJob('tenant-b', job.id)).toThrow(NotFoundError);
  });

  it('scopes job listing to tenant', () => {
    repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz A' });
    repo.createJob('tenant-b', 'user-2', { connectorId: 'gohighlevel', displayName: 'GHL B' });
    const jobsA = repo.listJobs('tenant-a');
    const jobsB = repo.listJobs('tenant-b');
    expect(jobsA).toHaveLength(1);
    expect(jobsB).toHaveLength(1);
    expect(jobsA[0].tenantKey).toBe('tenant-a');
    expect(jobsB[0].tenantKey).toBe('tenant-b');
  });

  it('scopes readiness to tenant', () => {
    repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz A' });
    repo.createJob('tenant-b', 'user-2', { connectorId: 'gohighlevel', displayName: 'GHL B' });
    const readinessA = repo.getReadiness('tenant-a');
    const readinessB = repo.getReadiness('tenant-b');
    const postizA = readinessA.connectors.find(c => c.connectorId === 'postiz');
    const postizB = readinessB.connectors.find(c => c.connectorId === 'postiz');
    expect(postizA?.jobId).not.toBeNull();
    expect(postizB?.jobId).toBeNull();
  });

  it('prevents disabling job from wrong tenant', () => {
    const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz A' });
    expect(() => repo.disableJob('tenant-b', job.id)).toThrow(NotFoundError);
  });

  it('prevents transitioning job from wrong tenant', () => {
    const job = repo.createJob('tenant-a', 'user-1', { connectorId: 'postiz', displayName: 'Postiz A' });
    expect(() => repo.transitionJob('tenant-b', job.id, 'ready_for_test')).toThrow(NotFoundError);
  });
});
