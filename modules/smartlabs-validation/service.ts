import { auditLog } from '@shared/logging';
import { assessCredentialReadiness, deriveValidationSummary } from './policy';
import { resolveSmartLabsCredential } from './repository';
import type { ValidationSummary } from './types';

export async function validateTenantSmartLabs(tenantKey: string, userId: string): Promise<ValidationSummary> {
  const credential = await resolveSmartLabsCredential(tenantKey);
  const readiness = assessCredentialReadiness(credential);
  const summary = deriveValidationSummary({
    tenantKey,
    credential: readiness,
    agentId: credential.agentId,
    voiceId: credential.voiceId,
    ttsBackend: credential.ttsBackend,
  });

  auditLog(
    {
      actor: `user:${userId}`,
      action: 'smartlabs_validation_check',
      object_type: 'smartlabs_validation',
      object_id: tenantKey,
      result: 'success',
    },
    `SmartLabs validation check for tenant ${tenantKey}`,
  );

  return summary;
}

export { assessCredentialReadiness, deriveValidationSummary };
export type { CredentialReadiness, ReadinessState, ValidationSummary } from './types';
