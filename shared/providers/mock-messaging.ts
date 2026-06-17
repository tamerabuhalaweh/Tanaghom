import { createHash } from 'crypto';
import type { MessagingProvider, MessageTemplate, MessageQueueResult } from './messaging';

function generatePayloadHash(data: Record<string, unknown>): string {
  const sorted = JSON.stringify(data, Object.keys(data).sort());
  return createHash('sha256').update(sorted).digest('hex');
}

export class MockMessagingProvider implements MessagingProvider {
  async prepareMessage(template: MessageTemplate): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];
    if (!template.channel) errors.push('Channel is required');
    if (!template.templateName) errors.push('Template name is required');
    return { valid: errors.length === 0, errors };
  }

  async validateTemplate(_template: MessageTemplate): Promise<{ valid: boolean; errors: string[] }> {
    return { valid: true, errors: [] };
  }

  async mockQueueMessage(template: MessageTemplate): Promise<MessageQueueResult> {
    const payloadHash = generatePayloadHash({
      channel: template.channel,
      templateName: template.templateName,
      variables: template.variables,
    });

    return {
      success: true,
      externalReference: `mock-msg-${Date.now()}`,
      messageId: `mock-msg-id-${Date.now()}`,
      payloadHash,
      payloadSummary: `Mock message via ${template.channel}: ${template.templateName}`,
    };
  }
}
