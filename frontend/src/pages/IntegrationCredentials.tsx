import { useEffect, useMemo, useState } from 'react';
import { ghlApi, integrationCredentialsApi, integrationStatusApi, postizApi, runtimeBridgesApi, socialOAuthApi } from '../api';
import { useAuth } from '../contexts/useAuth';
import {
  DetailGrid,
  EmptyProductState,
  Field,
  MetricCard,
  Notice,
  PrimaryAction,
  ProductCard,
  ProductPage,
  ProductStatus,
  ProductTable,
  SecondaryAction,
} from '../components/ProductUI';

type RecordMap = Record<string, unknown>;

function text(value: unknown, fallback = 'Not configured'): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function display(value: string): string {
  return value.replaceAll('_', ' ').replace(/\b\w/g, char => char.toUpperCase());
}

function statusTone(value: string): 'good' | 'warn' | 'danger' | 'info' | 'default' {
  const lower = value.toLowerCase();
  if (lower.includes('configured') || lower.includes('ready') || lower.includes('connected')) return 'good';
  if (lower.includes('missing') || lower.includes('requires')) return 'warn';
  if (lower.includes('blocked') || lower.includes('disabled')) return 'danger';
  return 'info';
}

function parseRequiredFields(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

export default function IntegrationCredentials() {
  const { token } = useAuth();
  const [status, setStatus] = useState<RecordMap | null>(null);
  const [postiz, setPostiz] = useState<RecordMap | null>(null);
  const [ghl, setGhl] = useState<RecordMap | null>(null);
  const [matrix, setMatrix] = useState<RecordMap[]>([]);
  const [credentials, setCredentials] = useState<RecordMap[]>([]);
  const [socialConnections, setSocialConnections] = useState<RecordMap[]>([]);
  const [postizChannels, setPostizChannels] = useState<RecordMap[]>([]);
  const [postizChannelStatus, setPostizChannelStatus] = useState<RecordMap | null>(null);
  const [runtimeStatuses, setRuntimeStatuses] = useState<RecordMap[]>([]);
  const [selected, setSelected] = useState<RecordMap | null>(null);
  const [oauthPlatform, setOauthPlatform] = useState('linkedin');
  const [postizPlatform, setPostizPlatform] = useState('instagram');
  const [displayName, setDisplayName] = useState('');
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [connectingPostiz, setConnectingPostiz] = useState(false);
  const [selectingPostizChannel, setSelectingPostizChannel] = useState('');

  async function load() {
    if (!token) return;
    const [integration, postizStatus, ghlStatus, matrixResult, credentialResult, socialResult, runtimeResult, postizChannelResult] = await Promise.all([
      integrationStatusApi.get(token),
      postizApi.status(token),
      ghlApi.status(token),
      integrationCredentialsApi.matrix(token),
      integrationCredentialsApi.list(token),
      socialOAuthApi.connections(token),
      runtimeBridgesApi.status(token),
      postizApi.channels(token).catch((err) => ({ status: 'requires_credentials', channels: [], _label: err instanceof Error ? err.message : 'Postiz channel status unavailable' })),
    ]);
    setStatus(integration as RecordMap);
    setPostiz(postizStatus as RecordMap);
    setGhl(ghlStatus as RecordMap);
    setMatrix(Array.isArray((matrixResult as RecordMap).rows) ? (matrixResult as RecordMap).rows as RecordMap[] : []);
    setCredentials(Array.isArray((credentialResult as RecordMap).credentials) ? (credentialResult as RecordMap).credentials as RecordMap[] : []);
    setSocialConnections(Array.isArray((socialResult as RecordMap).connections) ? (socialResult as RecordMap).connections as RecordMap[] : []);
    setRuntimeStatuses(Array.isArray((runtimeResult as RecordMap).statuses) ? (runtimeResult as RecordMap).statuses as RecordMap[] : []);
    setPostizChannelStatus(postizChannelResult as RecordMap);
    setPostizChannels(Array.isArray((postizChannelResult as RecordMap).channels) ? (postizChannelResult as RecordMap).channels as RecordMap[] : []);
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    async function run() {
      try {
        await load();
      } catch (err) {
        if (!cancelled) setMessage(err instanceof Error ? err.message : 'Failed to load integration status');
      }
    }
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const connectors = Array.isArray(status?.connectors) ? status.connectors as RecordMap[] : [];
  const aiProvider = status?.aiProvider as RecordMap | undefined;
  const configuredRows = matrix.filter(row => text(row.status).toLowerCase() === 'configured').length;
  const selectedFields = useMemo(() => parseRequiredFields(selected?.requiredFields), [selected]);
  const optionalFields = useMemo(() => parseRequiredFields(selected?.optionalFields), [selected]);
  const selectedPostizIntegrationId = typeof postizChannelStatus?.selectedIntegrationId === 'string' ? postizChannelStatus.selectedIntegrationId : '';
  const postizGuidance = (postizChannelStatus?.guidance || {}) as RecordMap;
  const postizNextActions = Array.isArray(postizGuidance.nextActions)
    ? postizGuidance.nextActions.filter((item): item is string => typeof item === 'string')
    : [];

  function chooseRequirement(row: RecordMap) {
    setSelected(row);
    setDisplayName(text(row.label));
    setSecretValues(Object.fromEntries([...parseRequiredFields(row.requiredFields), ...parseRequiredFields(row.optionalFields)].map(field => [field, ''])));
    setMessage('');
  }

  async function saveCredential() {
    if (!token || !selected) return;
    setSaving(true);
    setMessage('');
    try {
      const missing = selectedFields.filter(field => !secretValues[field]?.trim());
      if (missing.length) {
        setMessage(`Missing required fields: ${missing.join(', ')}`);
        return;
      }
      const secrets = Object.fromEntries(Object.entries(secretValues).filter(([, value]) => value.trim()));
      await integrationCredentialsApi.save({
        provider: selected.provider,
        credentialType: selected.credentialType,
        connectionKey: selected.connectionKey || 'default',
        displayName,
        secrets,
        metadata: {
          purpose: selected.purpose,
          sandboxOnly: true,
          source: 'admin_ui',
        },
      }, token);
      setMessage(`${text(selected.label)} saved. Raw secret values were encrypted and will not be shown again.`);
      setSecretValues(Object.fromEntries(selectedFields.map(field => [field, ''])));
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save credential');
    } finally {
      setSaving(false);
    }
  }

  async function connectPostizChannel() {
    if (!token) return;
    setConnectingPostiz(true);
    setMessage('');
    try {
      const result = await postizApi.connectChannel({ platform: postizPlatform }, token) as RecordMap;
      const authorizationUrl = text(result.authorizationUrl, '');
      if (!authorizationUrl) {
        setMessage(text(result._label, 'Postiz did not return an authorization URL. Check provider credentials in Postiz.'));
        return;
      }
      window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      setMessage(`Postiz ${display(postizPlatform)} authorization opened. Complete the provider login, then refresh channels.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start Postiz channel connection');
    } finally {
      setConnectingPostiz(false);
    }
  }

  async function selectPostizChannel(channelId: string) {
    if (!token) return;
    setSelectingPostizChannel(channelId);
    setMessage('');
    try {
      await postizApi.selectChannel({ integrationId: channelId }, token);
      setMessage('Postiz channel selected for scheduling packages. Raw credentials were not displayed or changed.');
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to select Postiz channel');
    } finally {
      setSelectingPostizChannel('');
    }
  }

  async function disableCredential(id: string) {
    if (!token) return;
    await integrationCredentialsApi.disable(id, token);
    await load();
  }

  async function startOAuth(platform: string) {
    if (!token) return;
    setMessage('');
    try {
      const result = await socialOAuthApi.start({ platform }, token) as RecordMap;
      const authorizationUrl = text(result.authorizationUrl, '');
      if (!authorizationUrl) {
        setMessage('OAuth start did not return an authorization URL.');
        return;
      }
      window.open(authorizationUrl, '_blank', 'noopener,noreferrer');
      setMessage(`OAuth authorization opened for ${display(platform)}. Complete the provider login in the new tab.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to start OAuth authorization');
    }
  }

  return (
    <ProductPage
      eyebrow="Admin"
      title="Credentials & Integration Setup"
      subtitle="Configure tenant integration credentials securely. Secrets are encrypted by the backend and never displayed after save."
      action={<ProductStatus tone="good">Tenant Vault</ProductStatus>}
    >
      {message && <Notice tone={message.toLowerCase().includes('failed') || message.toLowerCase().includes('missing') ? 'warn' : 'good'}>{message}</Notice>}

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="AI Provider" value={text(aiProvider?.provider, 'Requires LLM')} detail={text(aiProvider?.label, 'Status loaded from backend')} tone={statusTone(text(aiProvider?.label))} />
        <MetricCard label="Postiz" value={text(postiz?.status)} detail={`${text((postiz?.health as RecordMap | undefined)?.credentialStatus)} credential`} tone={statusTone(`${text(postiz?.status)} ${text((postiz?.health as RecordMap | undefined)?.credentialStatus)}`)} />
        <MetricCard label="GoHighLevel" value={text(ghl?._label)} detail={`${text(ghl?.apiKeyStatus)} API key`} tone={statusTone(`${text(ghl?._label)} ${text(ghl?.apiKeyStatus)}`)} />
        <MetricCard label="Tenant Vault" value={`${configuredRows}/${matrix.length}`} detail="Configured credential sets" tone={configuredRows > 0 ? 'good' : 'warn'} />
      </div>

      <ProductCard
        title="Postiz Social Channels"
        subtitle="Tanaghum can start Postiz channel OAuth and list connected channels. Postiz still owns the provider login and channel tokens."
      >
        <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-4">
            <DetailGrid items={[
              { label: 'Postiz Server', value: text(postiz?.status) },
              { label: 'API Key', value: text((postiz?.health as RecordMap | undefined)?.credentialStatus) },
              { label: 'Saved Channel ID', value: text((postiz?.health as RecordMap | undefined)?.integrationIdStatus) },
              { label: 'Connected Channels', value: String(postizChannels.length) },
            ]} />
            <Field label="Channel To Connect">
              <select
                value={postizPlatform}
                onChange={(event) => setPostizPlatform(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              >
                <option value="instagram">Instagram / Facebook via Meta</option>
                <option value="instagram-standalone">Instagram Standalone</option>
                <option value="linkedin">LinkedIn</option>
                <option value="x">X / Twitter</option>
                <option value="facebook">Facebook</option>
                <option value="threads">Threads</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
              </select>
            </Field>
            <div className="flex flex-wrap gap-2">
              <PrimaryAction onClick={connectPostizChannel} disabled={connectingPostiz}>
                {connectingPostiz ? 'Opening...' : 'Connect Channel via Postiz'}
              </PrimaryAction>
              <SecondaryAction onClick={() => void load()}>Refresh Channels</SecondaryAction>
            </div>
            <Notice tone="info">
              First save the Postiz API key and base URL below. For Instagram, Postiz must also have Meta/Instagram app credentials configured before OAuth can complete.
            </Notice>
          </div>
          {postizChannels.length ? (
            <ProductTable
              columns={['Channel', 'Provider', 'Profile', 'Status', 'Action']}
              rows={postizChannels.map(channel => {
                const channelId = text(channel.id, '');
                const disabled = Boolean(channel.disabled);
                const refreshNeeded = Boolean(channel.refreshNeeded);
                const selectedForScheduling = channelId === selectedPostizIntegrationId;
                return [
                  <div>
                    <div className="font-medium text-neutral-950">{text(channel.name, text(channel.profile, 'Unnamed channel'))}</div>
                    <div className="mt-1 text-xs text-neutral-500">{channelId}</div>
                  </div>,
                  display(text(channel.providerIdentifier || channel.type)),
                  text(channel.profile),
                  <ProductStatus tone={disabled || refreshNeeded ? 'warn' : 'good'}>
                    {selectedForScheduling ? 'Selected' : disabled ? 'Disabled' : refreshNeeded ? 'Reconnect Needed' : 'Connected'}
                  </ProductStatus>,
                  <SecondaryAction onClick={() => void selectPostizChannel(channelId)} disabled={!channelId || disabled || selectedForScheduling || selectingPostizChannel === channelId}>
                    {selectedForScheduling ? 'Selected' : selectingPostizChannel === channelId ? 'Saving...' : 'Use for Scheduling'}
                  </SecondaryAction>,
                ];
              })}
            />
          ) : (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
              <EmptyProductState
                title={text(postizGuidance.title, 'No Postiz channels connected')}
                message={text(postizChannelStatus?._label, 'Save Postiz API credentials, then connect a channel through Postiz.')}
              />
              {postizNextActions.length > 0 && (
                <div className="mt-5 rounded-lg border border-amber-200 bg-white p-4">
                  <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Next actions</div>
                  <ol className="mt-3 space-y-2 text-sm leading-6 text-amber-950">
                    {postizNextActions.map((action, index) => (
                      <li key={action} className="flex gap-3">
                        <span className="font-semibold">{index + 1}.</span>
                        <span>{action}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          )}
        </div>
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <ProductCard title="Credential Requirements" subtitle="Choose an integration and save the required sandbox credentials.">
          {matrix.length ? (
            <ProductTable
              columns={['Integration', 'Status', 'Fields', 'Action']}
              rows={matrix.map(row => [
                <div>
                <div className="font-medium text-neutral-950">{text(row.label)}</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-500">{text(row.purpose)}</div>
                  <div className="mt-1 text-[11px] uppercase tracking-[0.08em] text-neutral-400">{text(row.connectionKey, 'default')}</div>
                </div>,
                <ProductStatus tone={statusTone(text(row.status))}>{display(text(row.status))}</ProductStatus>,
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {parseRequiredFields(row.requiredFields).map(field => <ProductStatus key={field} tone="muted">{field}</ProductStatus>)}
                  </div>
                  {parseRequiredFields(row.optionalFields).length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {parseRequiredFields(row.optionalFields).map(field => <ProductStatus key={field} tone="info">Optional: {field}</ProductStatus>)}
                    </div>
                  )}
                </div>,
                <SecondaryAction onClick={() => chooseRequirement(row)}>Configure</SecondaryAction>,
              ])}
            />
          ) : (
            <EmptyProductState message="Credential requirements were not returned by the backend." />
          )}
        </ProductCard>

        <ProductCard title="Secure Setup Wizard" subtitle="Values entered here are sent once and stored encrypted.">
          {selected ? (
            <div className="space-y-4">
              <DetailGrid items={[
                { label: 'Integration', value: text(selected.label) },
                { label: 'Provider', value: text(selected.provider) },
                { label: 'Credential Type', value: text(selected.credentialType) },
                { label: 'Connection Key', value: text(selected.connectionKey, 'default') },
              ]} />
              <Field label="Display Name">
                <input
                  value={displayName}
                  onChange={event => setDisplayName(event.target.value)}
                  className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                />
              </Field>
              {selectedFields.map(field => (
                <Field key={field} label={display(field)} helper="Secret value is encrypted and never returned after save.">
                  <input
                    type={field.toLowerCase().includes('url') || field.toLowerCase().includes('uri') ? 'url' : 'password'}
                    value={secretValues[field] || ''}
                    onChange={event => setSecretValues(current => ({ ...current, [field]: event.target.value }))}
                    placeholder={`Enter ${field}`}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
              ))}
              {optionalFields.map(field => (
                <Field key={field} label={`${display(field)} (Optional)`} helper="Add this later after the provider creates it.">
                  <input
                    type={field.toLowerCase().includes('url') || field.toLowerCase().includes('uri') ? 'url' : 'password'}
                    value={secretValues[field] || ''}
                    onChange={event => setSecretValues(current => ({ ...current, [field]: event.target.value }))}
                    placeholder={`Enter ${field} when available`}
                    className="w-full rounded-md border border-neutral-200 px-3 py-2 text-sm"
                  />
                </Field>
              ))}
              <Notice tone="info">
                Saving credentials does not enable live execution. Postiz, CRM, messaging, and voice actions still require sandbox flags, approval, MCP mediation, and policy gates.
              </Notice>
              <PrimaryAction onClick={saveCredential} disabled={saving}>{saving ? 'Saving...' : 'Save Encrypted Credential'}</PrimaryAction>
            </div>
          ) : (
            <EmptyProductState title="Select an integration" message="Choose Configure next to Postiz, GoHighLevel, WhatsApp, Telegram, voice/chat, social OAuth, OpenClaw, agentgateway, or AgentScope." />
          )}
        </ProductCard>
      </div>

      <ProductCard title="Saved Credentials" subtitle="Only status, field names, and fingerprints are shown. Raw values are never returned.">
        {credentials.length ? (
          <ProductTable
            columns={['Credential', 'Fields', 'Fingerprints', 'Status', 'Action']}
            rows={credentials.map(credential => [
              <div>
                <div className="font-medium text-neutral-950">{text(credential.displayName)}</div>
                <div className="mt-1 text-xs text-neutral-500">{display(text(credential.provider))} / {display(text(credential.credentialType))} / {text(credential.connectionKey, 'default')}</div>
              </div>,
              <div className="flex flex-wrap gap-1">
                {parseRequiredFields(credential.secretFields).map(field => <ProductStatus key={field} tone="muted">{field}</ProductStatus>)}
              </div>,
              <div className="max-w-sm text-xs leading-5 text-neutral-500">
                {Object.entries((credential.secretFingerprints || {}) as Record<string, unknown>).map(([key, value]) => `${key}: ${String(value)}`).join(' | ') || 'Hidden'}
              </div>,
              <ProductStatus tone={credential.isActive ? 'good' : 'danger'}>{credential.isActive ? 'Configured' : 'Disabled'}</ProductStatus>,
              credential.isActive ? <SecondaryAction onClick={() => disableCredential(text(credential.id))}>Disable</SecondaryAction> : <ProductStatus tone="muted">Disabled</ProductStatus>,
            ])}
          />
        ) : (
          <EmptyProductState message="No tenant integration credentials have been saved yet." />
        )}
      </ProductCard>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <ProductCard title="Connect Social Account" subtitle="Use real provider OAuth. The callback stores encrypted tokens only after the provider confirms the account identity.">
          <div className="space-y-4">
            <Field label="Platform">
              <select
                value={oauthPlatform}
                onChange={(event) => setOauthPlatform(event.target.value)}
                className="w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              >
                <option value="linkedin">LinkedIn</option>
                <option value="meta">Meta / Instagram / Facebook</option>
                <option value="x">X / Twitter</option>
              </select>
            </Field>
            <Notice tone="info">
              Configure the matching OAuth client first. This starts a real provider redirect; no account is marked connected unless the callback exchanges a valid code.
            </Notice>
            <PrimaryAction onClick={() => startOAuth(oauthPlatform)}>Start OAuth Connection</PrimaryAction>
          </div>
        </ProductCard>

        <ProductCard title="Connected Social Accounts" subtitle="These are real OAuth account records from completed callbacks. Tokens are encrypted and never shown.">
          {socialConnections.length ? (
            <ProductTable
              columns={['Platform', 'Account', 'Scopes', 'Token', 'Status']}
              rows={socialConnections.map(connection => [
                display(text(connection.platform)),
                <div>
                  <div className="font-medium text-neutral-950">{text(connection.accountName, text(connection.accountId))}</div>
                  <div className="mt-1 text-xs text-neutral-500">{text(connection.accountId)}</div>
                </div>,
                <div className="flex flex-wrap gap-1">
                  {(Array.isArray(connection.scopes) ? connection.scopes : []).map(scope => <ProductStatus key={String(scope)} tone="muted">{String(scope)}</ProductStatus>)}
                </div>,
                <div className="text-xs text-neutral-500">Access token encrypted | Refresh token: {text(connection.refreshTokenStatus)}</div>,
                <ProductStatus tone={statusTone(text(connection.status))}>{display(text(connection.status))}</ProductStatus>,
              ])}
            />
          ) : (
            <EmptyProductState message="No social accounts are connected yet. Configure OAuth credentials and complete provider authorization." />
          )}
        </ProductCard>
      </div>

      <ProductCard title="Runtime Status" subtitle="Backend readiness view after tenant vault and deployment configuration are evaluated.">
        <ProductTable
          columns={['Connector', 'Credential', 'Endpoint', 'Execution Policy']}
          rows={connectors.map(connector => {
            const policy = (connector.executionPolicy || {}) as RecordMap;
            return [
              <div className="font-medium text-neutral-950">{text(connector.name)}</div>,
              <ProductStatus tone={statusTone(text(connector.credentialStatus))}>{display(text(connector.credentialStatus))}</ProductStatus>,
              <ProductStatus tone={statusTone(text(connector.endpointStatus))}>{display(text(connector.endpointStatus))}</ProductStatus>,
              <div>
                <ProductStatus tone={text(policy.label).toLowerCase().includes('blocked') ? 'danger' : 'warn'}>{text(policy.label, 'Blocked')}</ProductStatus>
                <div className="mt-1 text-xs text-neutral-500">{Array.isArray(policy.reasons) ? policy.reasons.join('; ') : text(policy.reason, 'Policy loaded')}</div>
              </div>,
            ];
          })}
        />
      </ProductCard>

      <ProductCard title="Runtime Bridges" subtitle="Live health checks for adjacent runtimes. These are not source of truth; STITCH controls business data and authorization.">
        {runtimeStatuses.length ? (
          <ProductTable
            columns={['Runtime', 'Configured', 'Reachable', 'Health', 'Secrets']}
            rows={runtimeStatuses.map(runtime => [
              display(text(runtime.provider)),
              <ProductStatus tone={runtime.configured ? 'good' : 'warn'}>{runtime.configured ? 'Configured' : 'Requires Credentials'}</ProductStatus>,
              <ProductStatus tone={runtime.reachable ? 'good' : 'warn'}>{runtime.reachable ? 'Reachable' : 'Not Reachable'}</ProductStatus>,
              text(runtime.label),
              <ProductStatus tone="muted">{runtime.rawSecretsReturned === false ? 'Hidden' : 'Review Required'}</ProductStatus>,
            ])}
          />
        ) : (
          <EmptyProductState message="Runtime bridge status is not available." />
        )}
      </ProductCard>
    </ProductPage>
  );
}
