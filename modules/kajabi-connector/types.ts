export const KAJABI_BASE_URL = 'https://api.kajabi.com';

export const KAJABI_SOURCE_LINKS = [
  'https://help.kajabi.com/api-reference/introduction',
  'https://help.kajabi.com/api-reference/authentication',
  'https://help.kajabi.com/api-reference/purchases/list-purchases',
] as const;

export const KAJABI_SUPPORTED_ENTITIES = [
  'contacts',
  'customers',
  'courses',
  'offers',
  'purchases',
  'orders',
  'transactions',
  'forms',
  'webhooks',
] as const;

export type KajabiStatus =
  | 'requires_credentials'
  | 'configured'
  | 'blocked_by_environment'
  | 'validated'
  | 'failed';

export interface KajabiConnectorStatus {
  provider: 'kajabi';
  displayName: 'Kajabi Course Platform';
  role: 'course_sales_source';
  status: KajabiStatus;
  credentialStatus: 'missing' | 'configured' | 'validated';
  readSyncEnabled: boolean;
  supportedEntities: typeof KAJABI_SUPPORTED_ENTITIES[number][];
  requiredCredentialFields: ['clientId', 'clientSecret'];
  optionalCredentialFields: ['baseUrl', 'siteId'];
  sourceLinks: typeof KAJABI_SOURCE_LINKS[number][];
  requiredActions: string[];
  evidence: {
    tokenAccepted?: boolean;
    purchasesEndpointChecked?: boolean;
    rowsFound?: number;
    providerEndpoint?: string;
  };
  readOnly: true;
  externalWritesAllowed: false;
  rawSecretsReturned: false;
  rawPayloadReturned: false;
}
