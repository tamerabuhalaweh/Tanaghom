import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/useAuth';
import { aiProviderApi } from '../api';
import { Notice, PrimaryAction, ProductCard, ProductPage, ProductStatus, SecondaryAction } from '../components/ProductUI';

interface ProviderStatus {
  name: string;
  type: 'mock' | 'openai' | 'claude' | 'deepseek';
  configured: boolean;
  model: string;
  apiKeyStatus: 'configured' | 'missing';
  scope?: string;
}

interface CredentialStatus {
  id: string;
  provider: 'openai' | 'claude' | 'deepseek';
  model: string;
  apiKeyStatus: string;
  keyFingerprint: string;
  isActive: boolean;
  lastUsedAt?: string | null;
  updatedAt: string;
}

const PROVIDERS = [
  { type: 'mock', name: 'Mock', defaultModel: 'mock-v1', keyLabel: 'No key required' },
  { type: 'openai', name: 'OpenAI', defaultModel: 'gpt-4o', keyLabel: 'OpenAI API key' },
  { type: 'claude', name: 'Claude', defaultModel: 'claude-sonnet-4-20250514', keyLabel: 'Claude API key' },
  { type: 'deepseek', name: 'DeepSeek', defaultModel: 'deepseek-v4-flash', keyLabel: 'DeepSeek API key' },
] as const;
const CONFIGURABLE_PROVIDERS = PROVIDERS.filter((provider) => provider.type !== 'mock');
type ConfigurableProviderType = (typeof CONFIGURABLE_PROVIDERS)[number]['type'];
type SelectableProviderType = ProviderStatus['type'];

export default function AIProviderSettings() {
  const { token } = useAuth();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [credentials, setCredentials] = useState<CredentialStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState<SelectableProviderType>('mock');
  const [selectedProvider, setSelectedProvider] = useState<ConfigurableProviderType>('deepseek');
  const [model, setModel] = useState('gpt-4o');
  const [apiKey, setApiKey] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState('');
  const [pageLoading, setPageLoading] = useState(Boolean(token));
  const [showGuide, setShowGuide] = useState(true);

  async function load() {
    if (!token) return;
    const [status, credentialData] = await Promise.all([
      aiProviderApi.status(token),
      aiProviderApi.credentials(token),
    ]);
    const statusMap = status as { providers: ProviderStatus[]; activeProvider: SelectableProviderType };
    const creds = credentialData as { credentials: CredentialStatus[]; activeProvider: SelectableProviderType };
    setProviders(statusMap.providers || []);
    setCredentials(creds.credentials || []);
    setActiveProvider(creds.activeProvider || statusMap.activeProvider || 'mock');
    const nextProvider = creds.activeProvider || statusMap.activeProvider || 'mock';
    const configurableProvider = nextProvider === 'openai' || nextProvider === 'claude' || nextProvider === 'deepseek' ? nextProvider : 'deepseek';
    const credential = (creds.credentials || []).find((item) => item.provider === configurableProvider);
    const nextMeta = CONFIGURABLE_PROVIDERS.find((provider) => provider.type === configurableProvider) || CONFIGURABLE_PROVIDERS[0];
    setSelectedProvider(configurableProvider);
    setModel(credential?.model || nextMeta.defaultModel);
    setApiKey('');
  }

  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    async function run() {
      try {
        const [status, credentialData] = await Promise.all([
          aiProviderApi.status(token as string),
          aiProviderApi.credentials(token as string),
        ]);
        if (cancelled) return;

        const statusMap = status as { providers: ProviderStatus[]; activeProvider: SelectableProviderType };
        const creds = credentialData as { credentials: CredentialStatus[]; activeProvider: SelectableProviderType };
        const nextProvider = creds.activeProvider || statusMap.activeProvider || 'mock';
        const configurableProvider = nextProvider === 'openai' || nextProvider === 'claude' || nextProvider === 'deepseek' ? nextProvider : 'deepseek';
        const credential = (creds.credentials || []).find((item) => item.provider === configurableProvider);
        const nextMeta = CONFIGURABLE_PROVIDERS.find((provider) => provider.type === configurableProvider) || CONFIGURABLE_PROVIDERS[0];

        setProviders(statusMap.providers || []);
        setCredentials(creds.credentials || []);
        setActiveProvider(nextProvider);
        setSelectedProvider(configurableProvider);
        setModel(credential?.model || nextMeta.defaultModel);
        setApiKey('');
        setPageLoading(false);
      } catch (err) {
        if (!cancelled) {
          setMessage(err instanceof Error ? err.message : 'Failed to load provider settings');
          setPageLoading(false);
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const selectedMeta = useMemo(
    () => PROVIDERS.find((provider) => provider.type === selectedProvider) || PROVIDERS[0],
    [selectedProvider],
  );

  const anyConnected = credentials.some((c) => c.apiKeyStatus === 'configured');
  const connectedCount = credentials.filter((c) => c.apiKeyStatus === 'configured').length;

  async function saveCredential() {
    if (!token) return;
    setLoading('save');
    setMessage('');
    try {
      await aiProviderApi.saveCredential({ provider: selectedProvider, model, apiKey }, token);
      setMessage(`API key saved securely. Your key is encrypted and never shown after this.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save key');
    } finally {
      setLoading('');
    }
  }

  async function saveTestAndUseProvider() {
    if (!token) return;
    setLoading('activate');
    setMessage('');
    try {
      await aiProviderApi.saveCredential({ provider: selectedProvider, model, apiKey }, token);
      const result = await aiProviderApi.test(selectedProvider, token) as { _label?: string; status?: string };
      await aiProviderApi.select(selectedProvider, token);
      setMessage(`${selectedMeta.name} connected and activated. ${result._label || 'Connection test passed.'}`);
      setApiKey('');
      setShowGuide(false);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setLoading('');
    }
  }

  async function selectProvider() {
    if (!token) return;
    setLoading('select');
    setMessage('');
    try {
      await aiProviderApi.select(selectedProvider, token);
      setActiveProvider(selectedProvider);
      setMessage(`${selectedMeta.name} is now your active AI model.`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to select provider');
    } finally {
      setLoading('');
    }
  }

  async function testProvider(provider: ConfigurableProviderType) {
    if (!token) return;
    setLoading(`test-${provider}`);
    setMessage('');
    try {
      const result = await aiProviderApi.test(provider, token) as { _label?: string; status?: string };
      setMessage(result._label || `Connection test ${result.status || 'completed'}`);
      await load();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Connection test failed');
    } finally {
      setLoading('');
    }
  }

  // ---- Skeleton loading ----
  if (pageLoading) {
    return (
      <ProductPage eyebrow="Content Studio" title="AI Settings" subtitle="Loading...">
        <div className="space-y-6">
          <div className="skeleton-pulse h-48 rounded-xl" />
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton-pulse h-48 rounded-xl" />
            ))}
          </div>
        </div>
      </ProductPage>
    );
  }

  return (
    <ProductPage
      eyebrow="Content Studio"
      title="AI Settings"
      subtitle="Connect your AI model to enable content generation. Your key is encrypted and never shared."
      action={
        <ProductStatus tone={anyConnected ? 'good' : 'warn'}>
          {anyConnected ? `${connectedCount} model(s) connected` : 'No models connected'}
        </ProductStatus>
      }
    >
      {message && (
        <Notice tone={message.toLowerCase().includes('failed') ? 'danger' : 'good'}>{message}</Notice>
      )}

      {/* ---- Setup Guide (collapsible) ---- */}
      {showGuide && (
        <ProductCard
          title="How to connect your AI model"
          subtitle="Three steps to enable AI-powered content generation."
          action={
            anyConnected ? (
              <button
                type="button"
                onClick={() => setShowGuide(false)}
                className="text-sm font-medium text-neutral-950 underline"
              >
                Hide guide
              </button>
            ) : undefined
          }
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              {
                step: '1',
                title: 'Get an API key',
                desc: 'Sign up with OpenAI, Claude, or DeepSeek and create an API key. Your key stays with you - you paste it once.',
              },
              {
                step: '2',
                title: 'Choose your model',
                desc: 'Pick which AI provider to use. You can connect multiple and switch between them anytime.',
              },
              {
                step: '3',
                title: 'Connect & test',
                desc: 'Paste your key, test the connection, and activate. Done - your AI is ready for content generation.',
              },
            ].map((item) => (
              <div key={item.step} className="rounded-lg border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-sm font-semibold text-white">
                  {item.step}
                </div>
                <div className="mt-3 text-sm font-semibold text-neutral-950">{item.title}</div>
                <p className="mt-1 text-sm leading-6 text-neutral-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </ProductCard>
      )}

      <div className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <ProductCard
          title="Connect a Model"
          subtitle="Your key is encrypted at rest and scoped to your account only."
        >
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Provider</span>
              <select
                value={selectedProvider}
                onChange={(event) => {
                  const provider = event.target.value as ConfigurableProviderType;
                  const credential = credentials.find((item) => item.provider === provider);
                  const nextMeta = CONFIGURABLE_PROVIDERS.find((item) => item.type === provider) || CONFIGURABLE_PROVIDERS[0];
                  setSelectedProvider(provider);
                  setModel(credential?.model || nextMeta.defaultModel);
                  setApiKey('');
                }}
                className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              >
                {CONFIGURABLE_PROVIDERS.map((provider) => (
                  <option key={provider.type} value={provider.type}>{provider.name}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">Model</span>
              <input
                value={model}
                onChange={(event) => setModel(event.target.value)}
                className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">{selectedMeta.keyLabel}</span>
              <input
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="Paste your key once - it will be encrypted and never shown again"
                className="mt-2 w-full rounded-md border border-neutral-200 bg-white p-3 text-sm text-neutral-950"
              />
            </label>

            <PrimaryAction
              onClick={saveTestAndUseProvider}
              disabled={!apiKey || loading === 'activate'}
            >
              {loading === 'activate' ? 'Connecting & testing...' : `Connect & Use ${selectedMeta.name}`}
            </PrimaryAction>

            <div className="grid grid-cols-2 gap-3">
              <SecondaryAction
                onClick={selectProvider}
                disabled={loading === 'select'}
              >
                {loading === 'select' ? 'Activating...' : 'Use This Model'}
              </SecondaryAction>
              <SecondaryAction
                onClick={saveCredential}
                disabled={!apiKey || loading === 'save'}
              >
                {loading === 'save' ? 'Saving...' : 'Save Key Only'}
              </SecondaryAction>
            </div>
          </div>
        </ProductCard>

        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            {PROVIDERS.map((provider) => {
              const status = providers.find((item) => item.type === provider.type);
              const credential = credentials.find((item) => item.provider === provider.type);
              const active = activeProvider === provider.type;
              const connected = credential?.apiKeyStatus === 'configured' || status?.apiKeyStatus === 'configured';
              return (
                <ProductCard key={provider.type} className={active ? 'border-blue-300 ring-1 ring-blue-200' : ''}>
                  <div className="space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-lg font-semibold text-neutral-950">{provider.name}</h3>
                        <p className="mt-1 text-xs text-neutral-500">
                          {provider.type === 'mock'
                            ? 'Development only'
                            : connected
                              ? 'Connected to your account'
                              : 'Not connected yet'}
                        </p>
                      </div>
                      <ProductStatus tone={active ? 'good' : connected ? 'info' : 'warn'}>
                        {active ? 'Active' : connected ? 'Connected' : 'Not set up'}
                      </ProductStatus>
                    </div>

                    <div className="space-y-2 text-sm">
                      <Line label="Model" value={credential?.model || status?.model || provider.defaultModel} />
                      <Line
                        label="Status"
                        value={
                          provider.type === 'mock'
                            ? 'No key needed'
                            : connected
                              ? 'Connected'
                              : 'Add your key to connect'
                        }
                      />
                    </div>

                    {provider.type !== 'mock' && (
                      <SecondaryAction
                        onClick={() => testProvider(provider.type)}
                        disabled={!credential || loading === `test-${provider.type}`}
                      >
                        {loading === `test-${provider.type}` ? 'Testing...' : 'Test Connection'}
                      </SecondaryAction>
                    )}
                  </div>
                </ProductCard>
              );
            })}
          </div>

          <Notice tone="info">
            Your keys are encrypted and belong to your account only. The app never stores or shows raw keys after you save them.
          </Notice>

          <ProductCard title="What you can do after connecting" subtitle="Once your AI model is connected, here's what's available.">
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { title: 'Generate campaign ideas', desc: 'Go to Content Creator and let AI propose creative directions.', to: '/content' },
                { title: 'Create content drafts', desc: 'Generate platform-specific posts from your campaign brief in the Dashboard.', to: '/dashboard' },
                { title: 'Content quality review', desc: 'AI scores your drafts for reach, clarity, and platform fit.', to: '/campaigns' },
                { title: 'Switch models anytime', desc: 'Connect multiple AI providers and switch between them for different needs.', to: null },
              ].map((item) => (
                <div key={item.title} className="rounded-lg border border-neutral-200 bg-neutral-50 p-4">
                  <div className="text-sm font-semibold text-neutral-950">{item.title}</div>
                  <p className="mt-1 text-sm leading-6 text-neutral-600">{item.desc}</p>
                  {item.to && (
                    <a href={item.to} className="mt-3 inline-block text-sm font-medium text-neutral-950 underline">
                      Open
                    </a>
                  )}
                </div>
              ))}
            </div>
          </ProductCard>
        </div>
      </div>
    </ProductPage>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-neutral-500">{label}</span>
      <span className="truncate text-right text-xs text-neutral-700">{value}</span>
    </div>
  );
}
