export interface MessageTemplate {
  channel: string;
  templateName: string;
  variables: Record<string, string>;
}

export interface MessageQueueResult {
  success: boolean;
  externalReference?: string;
  messageId?: string;
  error?: string;
  payloadHash: string;
  payloadSummary: string;
}

export interface MessagingProvider {
  prepareMessage(template: MessageTemplate): Promise<{ valid: boolean; errors: string[] }>;
  validateTemplate(template: MessageTemplate): Promise<{ valid: boolean; errors: string[] }>;
  mockQueueMessage(template: MessageTemplate): Promise<MessageQueueResult>;
}
