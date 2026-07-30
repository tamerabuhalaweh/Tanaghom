import type { GhlOperationType } from './types';

export const GHL_OPERATION_EXECUTION_FLAGS: Record<GhlOperationType, string> = {
  contact_upsert: 'GHL_CONTACT_UPSERT_ENABLED',
  contact_tags_update: 'GHL_CONTACT_TAGS_UPDATE_ENABLED',
  opportunity_upsert: 'GHL_OPPORTUNITY_UPSERT_ENABLED',
  appointment_upsert: 'GHL_APPOINTMENT_UPSERT_ENABLED',
  whatsapp_send: 'GHL_WHATSAPP_SEND_ENABLED',
};

const OPERATION_LABELS: Record<GhlOperationType, string> = {
  contact_upsert: 'Customer updates',
  contact_tags_update: 'Customer tags',
  opportunity_upsert: 'Sales and payments',
  appointment_upsert: 'Meetings',
  whatsapp_send: 'WhatsApp',
};

function enabled(name: string): boolean {
  return process.env[name] === 'true';
}

export function operationExecutionFlag(operationType: GhlOperationType): string {
  return GHL_OPERATION_EXECUTION_FLAGS[operationType];
}

export function isGhlOperationExecutionEnabled(operationType: GhlOperationType): boolean {
  return enabled(operationExecutionFlag(operationType));
}

export function operationRuntimeBlocker(operationType: GhlOperationType): string | null {
  const flag = operationExecutionFlag(operationType);
  return enabled(flag) ? null : `${flag} is not true`;
}

export function buildGhlExecutionReadiness(input: {
  credentialsReady: boolean;
  webhookLastVerifiedAt: Date | null;
}) {
  const baseFlagsReady =
    enabled('EXTERNAL_EXECUTION_ENABLED') &&
    enabled('M5_WRITE_EXECUTION_ENABLED') &&
    enabled('CRM_LIVE_ENABLED') &&
    enabled('GHL_WRITE_BACK_ENABLED');
  const workerEnabled = enabled('GHL_OPERATION_WORKER_ENABLED');

  const operations = Object.fromEntries(
    (Object.keys(GHL_OPERATION_EXECUTION_FLAGS) as GhlOperationType[]).map((operationType) => {
      const providerFlagReady =
        operationType === 'whatsapp_send' ? enabled('WHATSAPP_LIVE_ENABLED') : true;
      const operationEnabled =
        input.credentialsReady &&
        baseFlagsReady &&
        workerEnabled &&
        providerFlagReady &&
        isGhlOperationExecutionEnabled(operationType);
      return [
        operationType,
        {
          enabled: operationEnabled,
          state: operationEnabled ? ('live' as const) : ('approval_only' as const),
          label: OPERATION_LABELS[operationType],
          reason: operationEnabled
            ? 'Approved work executes through Tanaghum and is checked against GoHighLevel.'
            : operationType === 'whatsapp_send'
              ? 'WhatsApp remains unavailable until the customer connects and approves its GHL messaging setup.'
              : 'Work can be prepared and approved, but execution remains disabled.',
        },
      ];
    }),
  );

  const webhookEnabled = enabled('GHL_WEBHOOK_ENABLED');
  const liveVerified = Boolean(input.webhookLastVerifiedAt);
  return {
    providerWritesEnabled: baseFlagsReady,
    workerEnabled,
    operations,
    webhook: {
      enabled: webhookEnabled,
      liveVerified,
      state: liveVerified
        ? ('verified' as const)
        : webhookEnabled
          ? ('ready_to_receive' as const)
          : ('setup_required' as const),
      label: liveVerified
        ? 'Provider notifications verified'
        : webhookEnabled
          ? 'Waiting for the first signed provider notification'
          : 'Provider notifications need OAuth app setup',
      reason: liveVerified
        ? 'Tanaghum has received and verified a signed GoHighLevel callback.'
        : 'HighLevel live webhooks require an OAuth/Marketplace app; a Private Integration Token alone does not subscribe events.',
      lastVerifiedAt: input.webhookLastVerifiedAt?.toISOString() ?? null,
      signatureMode: 'ed25519',
    },
  };
}
