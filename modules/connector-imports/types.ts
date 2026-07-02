import { z } from 'zod';

export const SUPPORTED_CONNECTORS = [
  'postiz',
  'gohighlevel',
  'formaloo',
  'meta_analytics',
  'youtube_analytics',
  'whatsapp_provider',
  'telegram_provider',
  'smartlabs_voice',
] as const;

export type ConnectorId = (typeof SUPPORTED_CONNECTORS)[number];

export const IMPORT_JOB_STATES = [
  'draft',
  'requires_credentials',
  'ready_for_test',
  'test_passed',
  'blocked',
  'disabled',
] as const;

export type ImportJobState = (typeof IMPORT_JOB_STATES)[number];

export const CREDENTIAL_STATES = [
  'customer_credential_missing',
  'configured',
  'test_not_run',
  'test_passed',
  'blocked_by_provider_approval',
] as const;

export type CredentialState = (typeof CREDENTIAL_STATES)[number];

export const VALID_TRANSITIONS: Record<ImportJobState, ImportJobState[]> = {
  draft: ['requires_credentials', 'ready_for_test', 'disabled'],
  requires_credentials: ['ready_for_test', 'disabled'],
  ready_for_test: ['test_passed', 'blocked', 'disabled'],
  test_passed: ['blocked', 'disabled'],
  blocked: ['ready_for_test', 'disabled'],
  disabled: ['draft'],
};

export const CONNECTOR_REQUIREMENTS: Record<ConnectorId, {
  label: string;
  requiredCredentialFields: string[];
  optionalCredentialFields: string[];
  purpose: string;
}> = {
  postiz: {
    label: 'Postiz',
    requiredCredentialFields: ['apiKey', 'baseUrl'],
    optionalCredentialFields: ['integrationId'],
    purpose: 'Import social media scheduling and publishing data from Postiz workspace.',
  },
  gohighlevel: {
    label: 'GoHighLevel',
    requiredCredentialFields: ['apiKey', 'locationId'],
    optionalCredentialFields: [],
    purpose: 'Import CRM contacts, opportunities, and pipeline data from GoHighLevel.',
  },
  formaloo: {
    label: 'Formaloo',
    requiredCredentialFields: ['apiKey', 'formId'],
    optionalCredentialFields: ['workspaceId'],
    purpose: 'Import form submissions and survey responses from Formaloo.',
  },
  meta_analytics: {
    label: 'Meta Analytics',
    requiredCredentialFields: ['accessToken', 'adAccountId'],
    optionalCredentialFields: ['pageId'],
    purpose: 'Import read-only Meta/Facebook ad performance and page analytics.',
  },
  youtube_analytics: {
    label: 'YouTube Analytics',
    requiredCredentialFields: ['apiKey', 'channelId'],
    optionalCredentialFields: [],
    purpose: 'Import read-only YouTube channel and video analytics.',
  },
  whatsapp_provider: {
    label: 'WhatsApp Provider',
    requiredCredentialFields: ['accessToken', 'phoneNumberId'],
    optionalCredentialFields: ['businessAccountId'],
    purpose: 'Import WhatsApp message delivery and read receipts.',
  },
  telegram_provider: {
    label: 'Telegram Provider',
    requiredCredentialFields: ['botToken'],
    optionalCredentialFields: ['chatId'],
    purpose: 'Import Telegram bot message and engagement data.',
  },
  smartlabs_voice: {
    label: 'SmartLabs Voice',
    requiredCredentialFields: ['apiKey'],
    optionalCredentialFields: ['baseUrl', 'agentId'],
    purpose: 'Import voice agent conversation logs and analytics from SmartLabs.',
  },
};

export const createImportJobSchema = z.object({
  connectorId: z.enum(SUPPORTED_CONNECTORS),
  displayName: z.string().trim().min(2).max(200),
  eventId: z.string().uuid().optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const markReadySchema = z.object({
  testPassed: z.boolean().default(true),
  notes: z.string().trim().max(2000).optional(),
});

export const disableJobSchema = z.object({
  reason: z.string().trim().min(1).max(1000),
});

export const dryRunSchema = z.object({
  connectorId: z.enum(SUPPORTED_CONNECTORS),
  eventId: z.string().uuid().optional(),
});

export const approveImportSchema = z.object({
  connectorId: z.enum(SUPPORTED_CONNECTORS),
  eventId: z.string().uuid(),
  notes: z.string().trim().max(2000).optional(),
});

export type CreateImportJobInput = z.infer<typeof createImportJobSchema>;
export type MarkReadyInput = z.infer<typeof markReadySchema>;
export type DisableJobInput = z.infer<typeof disableJobSchema>;
export type DryRunInput = z.infer<typeof dryRunSchema>;
export type ApproveImportInput = z.infer<typeof approveImportSchema>;

export interface ConnectorImportJobSummary {
  id: string;
  tenantKey: string;
  eventId: string | null;
  connectorId: string;
  displayName: string;
  state: ImportJobState;
  credentialState: CredentialState;
  notes: string | null;
  lastDryRunAt: Date | null;
  lastDryRunResult: Record<string, unknown> | null;
  lastImportAt: Date | null;
  lastImportResult: Record<string, unknown> | null;
  approvedByUserId: string | null;
  approvedAt: Date | null;
  disabledAt: Date | null;
  disabledReason: string | null;
  createdByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ConnectorReadiness {
  connectorId: ConnectorId;
  label: string;
  jobState: ImportJobState | null;
  credentialState: CredentialState;
  purpose: string;
  requiredCredentialFields: string[];
  optionalCredentialFields: string[];
  jobId: string | null;
}

export interface ReadinessSummary {
  tenantKey: string;
  connectors: ConnectorReadiness[];
  totalConfigured: number;
  totalMissing: number;
  totalBlocked: number;
}

export interface DryRunKpiRow {
  metricDate: string;
  channel: string;
  reach: number;
  impressions: number;
  interactions: number;
  clicks: number;
  formCompletions: number;
  leads: number;
  meetingsBooked: number;
  meetingsAttended: number;
  purchases: number;
  noShows: number;
  spend: number;
  notes: string | null;
}

export interface DryRunResult {
  connectorId: string;
  eventId: string | null;
  kpiRows: DryRunKpiRow[];
  leadAttributions: number;
  warnings: string[];
}

export interface ImportResult {
  connectorId: string;
  eventId: string;
  imported: {
    kpiRecords: number;
    leadAttributions: number;
  };
  auditRecordId: string;
}
