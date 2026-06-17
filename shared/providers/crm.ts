export interface CrmLeadData {
  name: string;
  email?: string;
  phone?: string;
  source: string;
  campaignId?: string;
  metadata?: Record<string, unknown>;
}

export interface CrmHandoffResult {
  success: boolean;
  externalReference?: string;
  leadId?: string;
  error?: string;
  payloadHash: string;
  payloadSummary: string;
}

export interface CrmProvider {
  prepareHandoff(leadData: CrmLeadData): Promise<{ valid: boolean; errors: string[] }>;
  validatePayload(payload: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }>;
  mockCreateLead(leadData: CrmLeadData): Promise<CrmHandoffResult>;
}
