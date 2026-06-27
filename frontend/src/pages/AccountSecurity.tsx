import { useEffect, useState } from 'react';
import { authApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  Field,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not available'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export default function AccountSecurity() {
  const { token } = useAuth();
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [setup, setSetup] = useState<RecordMap | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [regenerateCode, setRegenerateCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!token) return;
    const result = await authApi.mfaStatus(token);
    setStatus(result as RecordMap);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        const result = await authApi.mfaStatus(token as string);
        if (!cancelled) setStatus(result as RecordMap);
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load security status');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function startSetup() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    setRecoveryCodes([]);
    try {
      const result = await authApi.mfaSetup(token);
      setSetup(result as RecordMap);
      setMessage('Authenticator setup started. Scan the URL or enter the one-time secret, then verify with a 6-digit code.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start MFA setup');
    } finally {
      setLoading(false);
    }
  }

  async function verifySetup() {
    if (!token || !setup) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await authApi.mfaVerify({ factorId: setup.factorId, code: verifyCode }, token) as RecordMap;
      setRecoveryCodes(Array.isArray(result.recoveryCodes) ? result.recoveryCodes.filter((item): item is string => typeof item === 'string') : []);
      setSetup(null);
      setVerifyCode('');
      setMessage('MFA is enabled. Save the recovery codes now; they will not be shown again.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to verify authenticator code');
    } finally {
      setLoading(false);
    }
  }

  async function regenerateCodes() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await authApi.mfaRegenerateRecoveryCodes({ code: regenerateCode }, token) as RecordMap;
      setRecoveryCodes(Array.isArray(result.recoveryCodes) ? result.recoveryCodes.filter((item): item is string => typeof item === 'string') : []);
      setRegenerateCode('');
      setMessage('New recovery codes generated. Old recovery codes are invalid now.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to regenerate recovery codes');
    } finally {
      setLoading(false);
    }
  }

  async function disableMfa() {
    if (!token) return;
    setLoading(true);
    setMessage('');
    try {
      await authApi.mfaDisable({ code: disableCode }, token);
      setDisableCode('');
      setRecoveryCodes([]);
      setMessage('MFA disabled for this account. Re-enable it before production customer access.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to disable MFA');
    } finally {
      setLoading(false);
    }
  }

  const enabled = status?.enabled === true;
  const recovery = (status?.recoveryCodes || {}) as RecordMap;
  const unusedCodes = numberValue(recovery.unused);

  return (
    <ProductPage
      eyebrow="Security"
      title="Account Security"
      subtitle="Protect your sign-in with an authenticator app and one-time recovery codes. Recovery codes are displayed once and stored only as hashes."
      action={<ProductStatus tone={enabled ? 'good' : 'warn'}>{enabled ? 'MFA Enabled' : 'MFA Required'}</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('invalid') ? 'danger' : 'info'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="MFA Status" value={enabled ? 'Enabled' : 'Off'} detail="Authenticator app protection" tone={enabled ? 'good' : 'warn'} />
        <MetricCard label="Recovery Codes" value={unusedCodes} detail="Unused one-time codes" tone={unusedCodes >= 5 ? 'good' : enabled ? 'warn' : 'muted'} />
        <MetricCard label="Raw Secrets" value="Never Stored" detail="Only encrypted secrets and hashes are persisted" tone="info" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <ProductCard title="Authenticator App" subtitle="Use Google Authenticator, 1Password, Microsoft Authenticator, or another TOTP app.">
          {!enabled && !setup && (
            <div className="space-y-4">
              <Notice tone="warn">Production customer access should require MFA for admins and department managers.</Notice>
              <PrimaryAction disabled={loading} onClick={startSetup}>{loading ? 'Starting...' : 'Set Up Authenticator'}</PrimaryAction>
            </div>
          )}

          {setup && (
            <div className="space-y-4">
              <DetailGrid items={[
                { label: 'Setup Secret', value: text(setup.secret) },
                { label: 'Returned Once', value: String(setup.rawSecretReturnedOnce) },
              ]} />
              <div className="rounded-md border border-neutral-200 bg-neutral-50 p-4 font-mono text-xs break-all text-neutral-700">
                {text(setup.otpauthUrl)}
              </div>
              <Field label="6-Digit Code">
                <input
                  value={verifyCode}
                  onChange={(event) => setVerifyCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                />
              </Field>
              <PrimaryAction disabled={loading || verifyCode.length !== 6} onClick={verifySetup}>
                Verify and Enable MFA
              </PrimaryAction>
            </div>
          )}

          {enabled && (
            <div className="space-y-4">
              <Notice tone="good">MFA is active. Future sign-ins require an authenticator code or a one-time recovery code.</Notice>
              <Field label="Authenticator Code to Regenerate Recovery Codes">
                <input
                  value={regenerateCode}
                  onChange={(event) => setRegenerateCode(event.target.value)}
                  inputMode="numeric"
                  maxLength={6}
                  className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
                />
              </Field>
              <SecondaryAction disabled={loading || regenerateCode.length !== 6} onClick={regenerateCodes}>
                Generate New Recovery Codes
              </SecondaryAction>
            </div>
          )}
        </ProductCard>

        <ProductCard title="Disable MFA" subtitle="Use only during controlled account recovery. Recovery codes are deleted when MFA is disabled.">
          <div className="space-y-4">
            <Field label="Authenticator Code">
              <input
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
                inputMode="numeric"
                maxLength={6}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950 outline-none focus:border-blue-500"
              />
            </Field>
            <SecondaryAction disabled={loading || !enabled || disableCode.length !== 6} onClick={disableMfa}>
              Disable MFA
            </SecondaryAction>
          </div>
        </ProductCard>
      </div>

      {recoveryCodes.length > 0 && (
        <ProductCard title="Recovery Codes" subtitle="Save these in a secure password manager now. They are shown once and cannot be retrieved later.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {recoveryCodes.map(code => (
              <div key={code} className="rounded-md border border-amber-200 bg-amber-50 p-3 text-center font-mono text-sm font-semibold text-amber-900">
                {code}
              </div>
            ))}
          </div>
        </ProductCard>
      )}
    </ProductPage>
  );
}
