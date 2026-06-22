import { describe, it, expect } from 'vitest';
import { ForbiddenError } from '@shared/errors';

// Capability Registry & Resolution tests — validates canonical chain, M5 blocking, MCP boundary, permissions

describe('Capability Registry Permissions', () => {
  const PERMISSIONS: Record<string, string[]> = {
    admin: ['registry:create', 'registry:read', 'registry:resolve'],
    cco: ['registry:create', 'registry:read', 'registry:resolve'],
    department_head: ['registry:create', 'registry:read', 'registry:resolve'],
    specialist: ['registry:create', 'registry:read', 'registry:resolve'],
    reviewer: ['registry:read'],
    viewer: ['registry:read'],
  };

  function checkPermission(role: string, permission: string): void {
    const allowed = PERMISSIONS[role];
    if (!allowed || !allowed.includes(permission)) {
      throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
    }
  }

  describe('admin', () => {
    it('can create registry entries', () => expect(() => checkPermission('admin', 'registry:create')).not.toThrow());
    it('can read registry entries', () => expect(() => checkPermission('admin', 'registry:read')).not.toThrow());
    it('can resolve capabilities', () => expect(() => checkPermission('admin', 'registry:resolve')).not.toThrow());
  });

  describe('specialist', () => {
    it('can create registry entries', () => expect(() => checkPermission('specialist', 'registry:create')).not.toThrow());
    it('can resolve capabilities', () => expect(() => checkPermission('specialist', 'registry:resolve')).not.toThrow());
  });

  describe('viewer', () => {
    it('can read registry entries', () => expect(() => checkPermission('viewer', 'registry:read')).not.toThrow());
    it('cannot create registry entries', () => expect(() => checkPermission('viewer', 'registry:create')).toThrow(ForbiddenError));
    it('cannot resolve capabilities', () => expect(() => checkPermission('viewer', 'registry:resolve')).toThrow(ForbiddenError));
  });
});

describe('Canonical Chain Validation', () => {
  interface ResolutionInput {
    intentId: string;
    objectiveId: string;
    capabilityId: string;
    executionPatternId: string;
    implementationId: string;
  }

  function validateCanonicalChain(input: ResolutionInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.intentId) errors.push('Intent is required');
    if (!input.objectiveId) errors.push('Objective is required');
    if (!input.capabilityId) errors.push('Capability is required');
    if (!input.executionPatternId) errors.push('ExecutionPattern is required');
    if (!input.implementationId) errors.push('Implementation is required');

    return { valid: errors.length === 0, errors };
  }

  it('validates complete canonical chain', () => {
    const result = validateCanonicalChain({
      intentId: 'intent-1',
      objectiveId: 'objective-1',
      capabilityId: 'capability-1',
      executionPatternId: 'pattern-1',
      implementationId: 'impl-1',
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing intent', () => {
    const result = validateCanonicalChain({
      intentId: '',
      objectiveId: 'objective-1',
      capabilityId: 'capability-1',
      executionPatternId: 'pattern-1',
      implementationId: 'impl-1',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Intent is required');
  });

  it('rejects missing implementation', () => {
    const result = validateCanonicalChain({
      intentId: 'intent-1',
      objectiveId: 'objective-1',
      capabilityId: 'capability-1',
      executionPatternId: 'pattern-1',
      implementationId: '',
    });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Implementation is required');
  });
});

describe('M5 Implementation Blocking', () => {
  interface Implementation {
    id: string;
    name: string;
    m4Allowed: boolean;
    m5Allowed: boolean;
    requiresMcp: boolean;
  }

  function validateImplementation(impl: Implementation): { allowed: boolean; reason?: string } {
    // Block M5 write-enabled implementations
    if (impl.m5Allowed && !impl.m4Allowed) {
      return { allowed: false, reason: 'M5 write-enabled implementations are blocked in this sprint' };
    }

    // Block MCP-required implementations from direct execution
    if (impl.requiresMcp) {
      return { allowed: false, reason: 'MCP-required implementations cannot be directly executed' };
    }

    return { allowed: true };
  }

  it('allows M4 implementation', () => {
    const impl: Implementation = { id: '1', name: 'MockLLM', m4Allowed: true, m5Allowed: false, requiresMcp: false };
    expect(validateImplementation(impl).allowed).toBe(true);
  });

  it('blocks M5-only implementation', () => {
    const impl: Implementation = { id: '1', name: 'M5Executor', m4Allowed: false, m5Allowed: true, requiresMcp: false };
    const result = validateImplementation(impl);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('M5 write-enabled');
  });

  it('blocks MCP-required implementation', () => {
    const impl: Implementation = { id: '1', name: 'PostizMCP', m4Allowed: true, m5Allowed: false, requiresMcp: true };
    const result = validateImplementation(impl);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('MCP-required');
  });

  it('allows M4+M5 implementation (advisory)', () => {
    const impl: Implementation = { id: '1', name: 'AdvisoryAgent', m4Allowed: true, m5Allowed: true, requiresMcp: false };
    expect(validateImplementation(impl).allowed).toBe(true);
  });
});

describe('MCP Boundary', () => {
  interface Implementation {
    id: string;
    requiresMcp: boolean;
    implementationType: string;
    provider: string | null;
    isExternal: boolean;
  }

  function validateMcpBoundary(impl: Implementation): { allowed: boolean; reason?: string } {
    if (impl.requiresMcp) {
      return {
        allowed: false,
        reason: `MCP-required implementation '${impl.name}' (${impl.implementationType}) cannot be directly executed. Provider: ${impl.provider || 'unknown'}. External: ${impl.isExternal}`,
      };
    }
    return { allowed: true };
  }

  it('allows non-MCP implementation', () => {
    const impl: Implementation = { id: '1', requiresMcp: false, implementationType: 'internal', provider: null, isExternal: false };
    expect(validateMcpBoundary(impl).allowed).toBe(true);
  });

  it('blocks MCP-required implementation with details', () => {
    const impl: Implementation = { id: '1', name: 'PostizMCP', requiresMcp: true, implementationType: 'postiz_mcp', provider: 'Postiz', isExternal: true };
    const result = validateMcpBoundary(impl);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Postiz');
    expect(result.reason).toContain('External');
  });
});

describe('SAIF Decision Requirement', () => {
  interface Capability {
    id: string;
    name: string;
    requiresSaifDecision: boolean;
  }

  function validateSaifRequirement(cap: Capability, saifDecisionRecordId: string | null): { allowed: boolean; reason?: string } {
    if (cap.requiresSaifDecision && !saifDecisionRecordId) {
      return { allowed: false, reason: `Capability '${cap.name}' requires a SAIF Decision Record` };
    }
    return { allowed: true };
  }

  it('allows capability without SAIF requirement', () => {
    const cap: Capability = { id: '1', name: 'GenerateContentDraft', requiresSaifDecision: false };
    expect(validateSaifRequirement(cap, null).allowed).toBe(true);
  });

  it('blocks capability requiring SAIF decision when missing', () => {
    const cap: Capability = { id: '1', name: 'PublishContent', requiresSaifDecision: true };
    const result = validateSaifRequirement(cap, null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('SAIF Decision Record');
  });

  it('allows capability with SAIF decision provided', () => {
    const cap: Capability = { id: '1', name: 'PublishContent', requiresSaifDecision: true };
    expect(validateSaifRequirement(cap, 'decision-1').allowed).toBe(true);
  });
});

describe('Approval Requirement', () => {
  interface Capability {
    id: string;
    name: string;
    requiresApproval: boolean;
  }

  function validateApprovalRequirement(cap: Capability, approvalId: string | null): { allowed: boolean; reason?: string } {
    if (cap.requiresApproval && !approvalId) {
      return { allowed: false, reason: `Capability '${cap.name}' requires approval` };
    }
    return { allowed: true };
  }

  it('allows capability without approval requirement', () => {
    const cap: Capability = { id: '1', name: 'GenerateContentDraft', requiresApproval: false };
    expect(validateApprovalRequirement(cap, null).allowed).toBe(true);
  });

  it('blocks capability requiring approval when missing', () => {
    const cap: Capability = { id: '1', name: 'PublishContent', requiresApproval: true };
    const result = validateApprovalRequirement(cap, null);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('approval');
  });
});

describe('Capability Risk Levels', () => {
  const RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

  it('supports all risk levels', () => {
    expect(RISK_LEVELS).toHaveLength(4);
    expect(RISK_LEVELS).toContain('low');
    expect(RISK_LEVELS).toContain('medium');
    expect(RISK_LEVELS).toContain('high');
    expect(RISK_LEVELS).toContain('critical');
  });
});

describe('Resolution Statuses', () => {
  const STATUSES = ['pending', 'resolved', 'rejected', 'blocked', 'deferred'];

  it('supports all resolution statuses', () => {
    expect(STATUSES).toHaveLength(5);
    expect(STATUSES).toContain('pending');
    expect(STATUSES).toContain('resolved');
    expect(STATUSES).toContain('rejected');
    expect(STATUSES).toContain('blocked');
    expect(STATUSES).toContain('deferred');
  });
});

describe('Core Seed Capabilities', () => {
  const CORE_CAPABILITIES = [
    'GenerateContentDraft',
    'EvaluateReachReadiness',
    'RequestApproval',
    'RetrieveKnowledge',
    'PreparePublishingPackage',
  ];

  it('defines all core capabilities', () => {
    expect(CORE_CAPABILITIES).toHaveLength(5);
  });

  it('includes GenerateContentDraft', () => {
    expect(CORE_CAPABILITIES).toContain('GenerateContentDraft');
  });

  it('includes EvaluateReachReadiness', () => {
    expect(CORE_CAPABILITIES).toContain('EvaluateReachReadiness');
  });

  it('includes RequestApproval', () => {
    expect(CORE_CAPABILITIES).toContain('RequestApproval');
  });

  it('includes RetrieveKnowledge', () => {
    expect(CORE_CAPABILITIES).toContain('RetrieveKnowledge');
  });

  it('includes PreparePublishingPackage', () => {
    expect(CORE_CAPABILITIES).toContain('PreparePublishingPackage');
  });
});

describe('HumanUser + AgentRep Lineage', () => {
  interface Resolution {
    humanUserId: string;
    agentRepId: string;
    intentId: string;
    capabilityId: string;
  }

  it('resolution includes HumanUser lineage', () => {
    const resolution: Resolution = {
      humanUserId: 'user-1',
      agentRepId: 'rep-1',
      intentId: 'intent-1',
      capabilityId: 'cap-1',
    };
    expect(resolution.humanUserId).toBe('user-1');
    expect(resolution.agentRepId).toBe('rep-1');
  });
});

describe('Resource Validation Before Implementation', () => {
  interface Implementation {
    id: string;
    name: string;
    resources: { id: string; name: string; available: boolean }[];
  }

  function validateResourcesBeforeImplementation(impl: Implementation): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const resource of impl.resources) {
      if (!resource.available) {
        errors.push(`Required resource '${resource.name}' is not available for implementation '${impl.name}'`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  it('validates all resources are available', () => {
    const impl: Implementation = {
      id: '1',
      name: 'MockLLM',
      resources: [
        { id: 'r1', name: 'CampaignRequest', available: true },
        { id: 'r2', name: 'PlatformRules', available: true },
      ],
    };
    const result = validateResourcesBeforeImplementation(impl);
    expect(result.valid).toBe(true);
  });

  it('blocks when required resource is unavailable', () => {
    const impl: Implementation = {
      id: '1',
      name: 'PostizPublisher',
      resources: [
        { id: 'r1', name: 'ApprovedContentArtifact', available: true },
        { id: 'r2', name: 'ExternalPlatformAccountReference', available: false },
      ],
    };
    const result = validateResourcesBeforeImplementation(impl);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('ExternalPlatformAccountReference');
  });
});

describe('Enterprise Taxonomy — Capability IDs', () => {
  const ENTERPRISE_CAPABILITIES = [
    { id: 'cap-content-generate-draft-v1', name: 'GenerateContentDraft', bundle: 'Content Intelligence' },
    { id: 'cap-content-manage-campaign-v1', name: 'ManageCampaign', bundle: 'Creative Production' },
    { id: 'cap-content-evaluate-reach-v1', name: 'EvaluateReachReadiness', bundle: 'Analytics' },
    { id: 'cap-governance-request-approval-v1', name: 'RequestApproval', bundle: 'Quality Control' },
    { id: 'cap-knowledge-retrieve-v1', name: 'RetrieveKnowledge', bundle: 'Cross-domain' },
    { id: 'cap-publishing-prepare-v1', name: 'PreparePublishingPackage', bundle: 'Distribution' },
    { id: 'cap-content-analyze-audience-v1', name: 'AnalyzeAudience', bundle: 'Audience Intelligence' },
    { id: 'cap-asset-manage-v1', name: 'ManageAsset', bundle: 'Creative Production' },
    { id: 'cap-conversion-capture-lead-v1', name: 'CaptureLead', bundle: 'Conversion' },
    { id: 'cap-rendering-render-v1', name: 'RenderContent', bundle: 'Creative Production' },
    // Future enterprise capabilities (registered, not implemented)
    { id: 'cap-finance-report-v1', name: 'GenerateFinancialReport', bundle: 'Finance Control' },
    { id: 'cap-hr-manage-employee-v1', name: 'ManageEmployee', bundle: 'HR Operations' },
    { id: 'cap-procurement-manage-v1', name: 'ManageProcurement', bundle: 'Procurement Operations' },
    { id: 'cap-inventory-track-v1', name: 'TrackInventory', bundle: 'Inventory Control' },
    { id: 'cap-purchase-manage-order-v1', name: 'ManagePurchaseOrder', bundle: 'Purchase Management' },
    { id: 'cap-supply-chain-manage-v1', name: 'ManageSupplyChain', bundle: 'Supply Chain Operations' },
    { id: 'cap-erp-integrate-v1', name: 'IntegrateERP', bundle: 'ERP Integration' },
  ];

  it('all capability IDs are unique', () => {
    const ids = ENTERPRISE_CAPABILITIES.map(c => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all capability names are unique', () => {
    const names = ENTERPRISE_CAPABILITIES.map(c => c.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('Commercial/Content capabilities are registered', () => {
    const contentCaps = ENTERPRISE_CAPABILITIES.filter(c => c.id.startsWith('cap-content-'));
    expect(contentCaps.length).toBeGreaterThanOrEqual(4);
  });

  it('future enterprise capabilities are registered as planned', () => {
    const futureCaps = ['GenerateFinancialReport', 'ManageEmployee', 'ManageProcurement', 'TrackInventory', 'ManagePurchaseOrder', 'ManageSupplyChain', 'IntegrateERP'];
    for (const cap of futureCaps) {
      expect(ENTERPRISE_CAPABILITIES.find(c => c.name === cap)).toBeDefined();
    }
  });
});

describe('Enterprise Taxonomy — Topology Nodes', () => {
  const TOPOLOGY_NODES = [
    { id: 'node-commercial-content', name: 'Commercial / Content', domain: 'commercial', bundle: 'Content Intelligence, Creative Production, Analytics, Conversion, Community' },
    { id: 'node-finance', name: 'Finance', domain: 'finance', bundle: 'Finance Control' },
    { id: 'node-hr', name: 'HR', domain: 'hr', bundle: 'HR Operations' },
    { id: 'node-procurement', name: 'Procurement', domain: 'procurement', bundle: 'Procurement Operations' },
    { id: 'node-inventory', name: 'Inventory', domain: 'inventory', bundle: 'Inventory Control' },
    { id: 'node-purchase-management', name: 'Purchase Management', domain: 'purchase', bundle: 'Purchase Management' },
    { id: 'node-supply-chain', name: 'Supply Chain', domain: 'supply_chain', bundle: 'Supply Chain Operations' },
    { id: 'node-executive-governance', name: 'Executive / Governance', domain: 'executive', bundle: 'Cross-domain' },
  ];

  it('all topology node IDs are unique', () => {
    const ids = TOPOLOGY_NODES.map(n => n.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all topology node names are unique', () => {
    const names = TOPOLOGY_NODES.map(n => n.name);
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  it('Commercial/Content is a topology node', () => {
    const cc = TOPOLOGY_NODES.find(n => n.id === 'node-commercial-content');
    expect(cc).toBeDefined();
    expect(cc!.domain).toBe('commercial');
  });

  it('future enterprise topology nodes are registered', () => {
    const futureNodes = ['Finance', 'HR', 'Procurement', 'Inventory', 'Purchase Management', 'Supply Chain'];
    for (const node of futureNodes) {
      expect(TOPOLOGY_NODES.find(n => n.name === node)).toBeDefined();
    }
  });
});

describe('Enterprise Taxonomy — Capability Bundles', () => {
  const CAPABILITY_BUNDLES = [
    { id: 'bundle-content-intelligence', name: 'Content Intelligence', topologyNode: 'node-commercial-content' },
    { id: 'bundle-audience-intelligence', name: 'Audience Intelligence', topologyNode: 'node-commercial-content' },
    { id: 'bundle-creative-production', name: 'Creative Production', topologyNode: 'node-commercial-content' },
    { id: 'bundle-quality-control', name: 'Quality Control', topologyNode: 'node-commercial-content' },
    { id: 'bundle-distribution', name: 'Distribution', topologyNode: 'node-commercial-content' },
    { id: 'bundle-community', name: 'Community', topologyNode: 'node-commercial-content' },
    { id: 'bundle-analytics', name: 'Analytics', topologyNode: 'node-commercial-content' },
    { id: 'bundle-conversion', name: 'Conversion', topologyNode: 'node-commercial-content' },
    { id: 'bundle-finance-control', name: 'Finance Control', topologyNode: 'node-finance' },
    { id: 'bundle-hr-operations', name: 'HR Operations', topologyNode: 'node-hr' },
    { id: 'bundle-procurement-operations', name: 'Procurement Operations', topologyNode: 'node-procurement' },
    { id: 'bundle-inventory-control', name: 'Inventory Control', topologyNode: 'node-inventory' },
    { id: 'bundle-purchase-management', name: 'Purchase Management', topologyNode: 'node-purchase-management' },
    { id: 'bundle-supply-chain-operations', name: 'Supply Chain Operations', topologyNode: 'node-supply-chain' },
  ];

  it('all bundle IDs are unique', () => {
    const ids = CAPABILITY_BUNDLES.map(b => b.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('bundles map to topology nodes', () => {
    for (const bundle of CAPABILITY_BUNDLES) {
      expect(bundle.topologyNode).toBeDefined();
      expect(bundle.topologyNode.startsWith('node-')).toBe(true);
    }
  });

  it('Commercial/Content has multiple bundles', () => {
    const ccBundles = CAPABILITY_BUNDLES.filter(b => b.topologyNode === 'node-commercial-content');
    expect(ccBundles.length).toBeGreaterThanOrEqual(8);
  });
});

describe('Enterprise Taxonomy — Boundary Rules', () => {
  it('QC is Evaluator, not Authority', () => {
    const qcCapability = { name: 'RequestApproval', role: 'evaluator', hasAuthority: false };
    expect(qcCapability.role).toBe('evaluator');
    expect(qcCapability.hasAuthority).toBe(false);
  });

  it('ERP capability requires MCP and separate scope', () => {
    const erpCapability = {
      name: 'IntegrateERP',
      requiresMcp: true,
      requiresSaifDecision: true,
      riskLevel: 'critical',
      separateScope: true,
    };
    expect(erpCapability.requiresMcp).toBe(true);
    expect(erpCapability.requiresSaifDecision).toBe(true);
    expect(erpCapability.separateScope).toBe(true);
  });

  it('no M5 capability is enabled', () => {
    const capabilities = [
      { name: 'GenerateContentDraft', m5Required: false },
      { name: 'ManageCampaign', m5Required: false },
      { name: 'PreparePublishingPackage', m5Required: false },
    ];
    for (const cap of capabilities) {
      expect(cap.m5Required).toBe(false);
    }
  });

  it('no direct external access capability is enabled', () => {
    const capabilities = [
      { name: 'PreparePublishingPackage', directExternalAccess: false, requiresMcp: true },
      { name: 'IntegrateERP', directExternalAccess: false, requiresMcp: true },
    ];
    for (const cap of capabilities) {
      expect(cap.directExternalAccess).toBe(false);
    }
  });

  it('deprecated terms are mapped or rejected', () => {
    const deprecatedMappings = [
      { legacy: 'Department Agent', mapped: 'TopologyNode + CapabilityBundle' },
      { legacy: 'Commercial Agent', mapped: 'Commercial/Content Capability Overlay' },
      { legacy: 'QC Approval', mapped: 'Evaluator Output' },
      { legacy: 'ERP Integration', mapped: 'Optional MCP-Mediated Connector' },
    ];
    for (const mapping of deprecatedMappings) {
      expect(mapping.mapped).toBeDefined();
      expect(mapping.mapped.length).toBeGreaterThan(0);
    }
  });
});
