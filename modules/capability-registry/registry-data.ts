export interface EnterpriseCapability {
  id: string;
  name: string;
  description: string;
  category: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresApproval: boolean;
  requiresSaifDecision: boolean;
  allowedAgentTypes: string[];
  bundle: string;
  domain: string;
  implemented: boolean;
}

export interface TopologyNode {
  id: string;
  name: string;
  domain: string;
  bundles: string[];
}

export interface CapabilityBundle {
  id: string;
  name: string;
  topologyNode: string;
  domain: string;
}

export const ENTERPRISE_CAPABILITIES: EnterpriseCapability[] = [
  // Commercial/Content (implemented)
  { id: 'cap-content-generate-draft-v1', name: 'GenerateContentDraft', description: 'Generate platform-specific content drafts using LLM', category: 'content', riskLevel: 'medium', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Content Intelligence', domain: 'commercial', implemented: true },
  { id: 'cap-content-manage-campaign-v1', name: 'ManageCampaign', description: 'Create, manage, and track marketing campaigns', category: 'content', riskLevel: 'medium', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Creative Production', domain: 'commercial', implemented: true },
  { id: 'cap-content-evaluate-reach-v1', name: 'EvaluateReachReadiness', description: 'Evaluate content for reach readiness score and platform optimization', category: 'analysis', riskLevel: 'low', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Analytics', domain: 'commercial', implemented: true },
  { id: 'cap-governance-request-approval-v1', name: 'RequestApproval', description: 'Submit content for approval workflow', category: 'governance', riskLevel: 'medium', requiresApproval: true, requiresSaifDecision: false, allowedAgentTypes: ['functional', 'governance'], bundle: 'Quality Control', domain: 'commercial', implemented: true },
  { id: 'cap-knowledge-retrieve-v1', name: 'RetrieveKnowledge', description: 'Retrieve knowledge from DKS or platform rules', category: 'knowledge', riskLevel: 'low', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional', 'governance'], bundle: 'Cross-domain', domain: 'commercial', implemented: true },
  { id: 'cap-publishing-prepare-v1', name: 'PreparePublishingPackage', description: 'Prepare content package for publishing', category: 'publishing', riskLevel: 'high', requiresApproval: true, requiresSaifDecision: true, allowedAgentTypes: ['functional'], bundle: 'Distribution', domain: 'commercial', implemented: true },
  { id: 'cap-content-analyze-audience-v1', name: 'AnalyzeAudience', description: 'Analyze audience intelligence and market trends', category: 'analysis', riskLevel: 'low', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Audience Intelligence', domain: 'commercial', implemented: true },
  { id: 'cap-asset-manage-v1', name: 'ManageAsset', description: 'Manage digital assets and creative resources', category: 'asset', riskLevel: 'low', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Creative Production', domain: 'commercial', implemented: true },
  { id: 'cap-conversion-capture-lead-v1', name: 'CaptureLead', description: 'Capture and route leads through CRM integration', category: 'conversion', riskLevel: 'medium', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Conversion', domain: 'commercial', implemented: true },
  { id: 'cap-rendering-render-v1', name: 'RenderContent', description: 'Render visual content and creative assets', category: 'rendering', riskLevel: 'low', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Creative Production', domain: 'commercial', implemented: true },
  // Future enterprise (registered, not implemented)
  { id: 'cap-finance-report-v1', name: 'GenerateFinancialReport', description: 'Generate financial reports and analysis [FUTURE]', category: 'finance', riskLevel: 'high', requiresApproval: true, requiresSaifDecision: true, allowedAgentTypes: ['functional'], bundle: 'Finance Control', domain: 'finance', implemented: false },
  { id: 'cap-hr-manage-employee-v1', name: 'ManageEmployee', description: 'Manage employee records and HR operations [FUTURE]', category: 'hr', riskLevel: 'high', requiresApproval: true, requiresSaifDecision: true, allowedAgentTypes: ['functional'], bundle: 'HR Operations', domain: 'hr', implemented: false },
  { id: 'cap-procurement-manage-v1', name: 'ManageProcurement', description: 'Manage procurement and vendor operations [FUTURE]', category: 'procurement', riskLevel: 'high', requiresApproval: true, requiresSaifDecision: true, allowedAgentTypes: ['functional'], bundle: 'Procurement Operations', domain: 'procurement', implemented: false },
  { id: 'cap-inventory-track-v1', name: 'TrackInventory', description: 'Track inventory and stock levels [FUTURE]', category: 'inventory', riskLevel: 'medium', requiresApproval: false, requiresSaifDecision: false, allowedAgentTypes: ['functional'], bundle: 'Inventory Control', domain: 'inventory', implemented: false },
  { id: 'cap-purchase-manage-order-v1', name: 'ManagePurchaseOrder', description: 'Manage purchase orders and receiving [FUTURE]', category: 'purchase', riskLevel: 'high', requiresApproval: true, requiresSaifDecision: true, allowedAgentTypes: ['functional'], bundle: 'Purchase Management', domain: 'purchase', implemented: false },
  { id: 'cap-supply-chain-manage-v1', name: 'ManageSupplyChain', description: 'Manage supply chain and logistics [FUTURE]', category: 'supply_chain', riskLevel: 'high', requiresApproval: true, requiresSaifDecision: true, allowedAgentTypes: ['functional'], bundle: 'Supply Chain Operations', domain: 'supply_chain', implemented: false },
  { id: 'cap-erp-integrate-v1', name: 'IntegrateERP', description: 'Integrate with ERP systems via MCP mediation [FUTURE, separate scope]', category: 'erp', riskLevel: 'critical', requiresApproval: true, requiresSaifDecision: true, allowedAgentTypes: ['functional'], bundle: 'ERP Integration', domain: 'erp', implemented: false },
];

export const TOPOLOGY_NODES: TopologyNode[] = [
  { id: 'node-commercial-content', name: 'Commercial / Content', domain: 'commercial', bundles: ['Audience Intelligence', 'Content Intelligence', 'Creative Production', 'Quality Control', 'Distribution', 'Community', 'Analytics', 'Conversion'] },
  { id: 'node-finance', name: 'Finance', domain: 'finance', bundles: ['Finance Control'] },
  { id: 'node-hr', name: 'HR', domain: 'hr', bundles: ['HR Operations'] },
  { id: 'node-procurement', name: 'Procurement', domain: 'procurement', bundles: ['Procurement Operations'] },
  { id: 'node-inventory', name: 'Inventory', domain: 'inventory', bundles: ['Inventory Control'] },
  { id: 'node-purchase-management', name: 'Purchase Management', domain: 'purchase', bundles: ['Purchase Management'] },
  { id: 'node-supply-chain', name: 'Supply Chain', domain: 'supply_chain', bundles: ['Supply Chain Operations'] },
  { id: 'node-executive-governance', name: 'Executive / Governance', domain: 'executive', bundles: ['Cross-domain'] },
];

export const CAPABILITY_BUNDLES: CapabilityBundle[] = [
  { id: 'bundle-audience-intelligence', name: 'Audience Intelligence', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-content-intelligence', name: 'Content Intelligence', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-creative-production', name: 'Creative Production', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-quality-control', name: 'Quality Control', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-distribution', name: 'Distribution', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-community', name: 'Community', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-analytics', name: 'Analytics', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-conversion', name: 'Conversion', topologyNode: 'node-commercial-content', domain: 'commercial' },
  { id: 'bundle-finance-control', name: 'Finance Control', topologyNode: 'node-finance', domain: 'finance' },
  { id: 'bundle-hr-operations', name: 'HR Operations', topologyNode: 'node-hr', domain: 'hr' },
  { id: 'bundle-procurement-operations', name: 'Procurement Operations', topologyNode: 'node-procurement', domain: 'procurement' },
  { id: 'bundle-inventory-control', name: 'Inventory Control', topologyNode: 'node-inventory', domain: 'inventory' },
  { id: 'bundle-purchase-management', name: 'Purchase Management', topologyNode: 'node-purchase-management', domain: 'purchase' },
  { id: 'bundle-supply-chain-operations', name: 'Supply Chain Operations', topologyNode: 'node-supply-chain', domain: 'supply_chain' },
];

export const DEPRECATED_MAPPINGS = [
  { legacy: 'Department Agent', mapped: 'TopologyNode + CapabilityBundle' },
  { legacy: 'Commercial Agent', mapped: 'Commercial/Content Capability Overlay' },
  { legacy: 'QC Approval', mapped: 'Evaluator Output' },
  { legacy: 'ERP Integration', mapped: 'Optional MCP-Mediated Connector' },
];
