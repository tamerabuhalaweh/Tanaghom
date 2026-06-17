import { createHash } from 'crypto';
import type { CrmProvider, CrmLeadData, CrmHandoffResult } from './crm';

function generatePayloadHash(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(sorted).digest('hex');
}

export class MockCrmProvider implements CrmProvider {
  async prepareHandoff(leadData: CrmLeadData): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!leadData.name) errors.push('Lead name is required');
    if (!leadData.source) errors.push('Lead source is required');
    return { valid: errors.length === 0, errors };
  }

  async validatePayload(_payload: Record<string, unknown>): Promise<{ valid: boolean; errors: string[] }> {
    return { valid: true, errors: [] };
  }

  async mockCreateLead(leadData: CrmLeadData): Promise<CrmHandoffResult> {
    const payloadHash = generatePayloadHash({
      name: leadData.name,
      source: leadData.source,
      campaignId: leadData.campaignId || 'none',
    });

    return {
      success: true,
      externalReference: `mock-crm-lead-${Date.now()}`,
      leadId: `mock-lead-${Date.now()}`,
      payloadHash,
      payloadSummary: `Mock CRM lead: ${leadData.name} from ${leadData.source}`,
    };
  }
}
