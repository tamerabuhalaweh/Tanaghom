import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { aiProviderApi } from '../api';
import { Card, StatusBadge, Alert, DemoLabel } from '../components/UI';

interface ProviderStatus {
  name: string;
  type: string;
  configured: boolean;
  model: string;
  apiKeyStatus: 'configured' | 'missing';
}

export default function AIProviderSettings() {
  const { token } = useAuth();
  const [providers, setProviders] = useState<ProviderStatus[]>([]);
  const [activeProvider, setActiveProvider] = useState('mock');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      aiProviderApi.status(token)
        .then(data => {
          setProviders((data as { providers: ProviderStatus[] }).providers || []);
          setActiveProvider((data as { activeProvider: string }).activeProvider || 'mock');
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [token]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">AI Provider Settings</h1>
        <DemoLabel>Admin Only</DemoLabel>
      </div>

      <Alert type="info">
        <strong>AI Provider Control Plane</strong> — Configure LLM providers for content generation. 
        All model calls go through STITCH backend. Mock remains default unless explicitly configured.
      </Alert>

      <Alert type="warning">
        <strong>Security:</strong> API keys are stored in environment variables only. 
        Never enter keys in this UI. Keys must be set via deployment secrets.
      </Alert>

      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading providers...</div>
      ) : (
        <div className="grid grid-cols-3 gap-6">
          {[
            { name: 'Mock LLM', type: 'mock', description: 'Default provider. No external API calls.', status: 'always available' },
            { name: 'OpenAI', type: 'openai', description: 'OpenAI-compatible provider slot. Prepared; live calls disabled for demo.', status: 'requires OPENAI_API_KEY' },
            { name: 'Claude', type: 'claude', description: 'Claude provider slot. Prepared; live calls disabled for demo.', status: 'requires CLAUDE_API_KEY' },
          ].map(p => {
            const providerStatus = providers.find(pr => pr.type === p.type);
            const isConfigured = providerStatus?.configured || p.type === 'mock';
            const isActive = activeProvider === p.type;

            return (
              <Card key={p.type} className={isActive ? 'border-2 border-blue-500' : ''}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-lg">{p.name}</h3>
                    {isActive && <StatusBadge label="Active" variant="success" />}
                    {!isActive && isConfigured && <StatusBadge label="Configured" variant="info" />}
                    {!isActive && !isConfigured && <StatusBadge label="Not Configured" variant="default" />}
                  </div>

                  <p className="text-sm text-gray-400">{p.description}</p>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Model:</span>
                      <span className="font-mono">{providerStatus?.model || (p.type === 'mock' ? 'mock-v1' : 'Not set')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">API Key:</span>
                      <span className={isConfigured ? 'text-emerald-400' : 'text-rose-400'}>
                        {p.type === 'mock' ? 'Not required' : (providerStatus?.apiKeyStatus === 'configured' ? 'Configured' : 'Missing')}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Env Variable:</span>
                      <span className="font-mono text-xs">{p.type === 'mock' ? 'LLM_PROVIDER=mock' : p.type === 'openai' ? 'OPENAI_API_KEY' : 'CLAUDE_API_KEY'}</span>
                    </div>
                  </div>

                  {isActive && (
                    <div className="rounded-lg border border-blue-800 bg-blue-950/60 p-2 text-center text-xs font-medium text-blue-300">
                      Currently Active
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Card title="Configuration Instructions">
        <div className="space-y-3 text-sm">
          <div className="bg-gray-50 rounded p-3">
            <div className="font-medium mb-1">To switch providers:</div>
            <div className="font-mono text-xs">LLM_PROVIDER=openai  # or claude, mock</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="font-medium mb-1">To configure OpenAI:</div>
            <div className="font-mono text-xs">OPENAI_API_KEY=&lt;configured in deployment secrets&gt;</div>
            <div className="font-mono text-xs">OPENAI_MODEL=gpt-4o</div>
          </div>
          <div className="bg-gray-50 rounded p-3">
            <div className="font-medium mb-1">To configure Claude:</div>
            <div className="font-mono text-xs">CLAUDE_API_KEY=&lt;configured in deployment secrets&gt;</div>
            <div className="font-mono text-xs">CLAUDE_MODEL=claude-sonnet-4-20250514</div>
          </div>
        </div>
      </Card>

      <Alert type="info">
        <strong>Architecture:</strong> All model calls go through STITCH backend. 
        OpenClaw is channel/orchestration only — no direct publishing, no CRM/WhatsApp, no M5.
      </Alert>
    </div>
  );
}
