import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/useAuth';
import { ghlApi, leadsApi } from '../api';
import { Badge } from '../components/ExecutiveUI';

type WizardStep = 'connection' | 'data' | 'safety' | 'authorization' | 'complete';

interface WizardState {
  connectionType: string;
  dataToSend: Record<string, boolean>;
  safetyMode: string;
  authorization: Record<string, boolean>;
}

const CONNECTION_TYPES = [
  { id: 'readiness', label: 'Readiness Only', description: 'Check if GHL is available and configured', risk: 'low' },
  { id: 'sandbox_validation', label: 'Sandbox Validation', description: 'Test connection with sandbox credentials', risk: 'low' },
  { id: 'handoff_package', label: 'Lead Handoff Package Only', description: 'Prepare lead data package without pushing', risk: 'low' },
  { id: 'sandbox_contact', label: 'Sandbox Contact Creation', description: 'Create test contact in sandbox environment', risk: 'medium' },
  { id: 'sandbox_opportunity', label: 'Sandbox Opportunity Creation', description: 'Create test opportunity in sandbox environment', risk: 'medium' },
  { id: 'production_write', label: 'Production CRM Write-back', description: 'Future only — requires explicit authorization', risk: 'high' },
];

const DATA_FIELDS = [
  { id: 'leadName', label: 'Lead Name', required: true },
  { id: 'phone', label: 'Phone', required: false },
  { id: 'email', label: 'Email', required: false },
  { id: 'sourceCampaign', label: 'Source Campaign', required: true },
  { id: 'platform', label: 'Platform', required: true },
  { id: 'qualificationScore', label: 'Qualification Score', required: true },
  { id: 'consentStatus', label: 'Consent Status', required: true },
  { id: 'notes', label: 'Notes / AI Summary', required: false },
  { id: 'suggestedAction', label: 'Suggested Next Action', required: false },
];

const SAFETY_MODES = [
  { id: 'prepare_only', label: 'Prepare Only', description: 'Generate handoff package without any external call' },
  { id: 'sandbox_write', label: 'Sandbox Write', description: 'Write to sandbox environment only' },
  { id: 'approval_gated', label: 'Approval-Gated Write', description: 'Requires human approval before any write' },
  { id: 'production_disabled', label: 'Production Write Disabled', description: 'Production writes blocked by policy' },
];

export default function GhlWizard() {
  const { token } = useAuth();
  const [step, setStep] = useState<WizardStep>('connection');
  const [ghlStatus, setGhlStatus] = useState<Record<string, unknown> | null>(null);
  const [leads, setLeads] = useState<Record<string, unknown>[]>([]);
  const [selectedLead, setSelectedLead] = useState<string>('');
  const [handoffResult, setHandoffResult] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const [wizardState, setWizardState] = useState<WizardState>({
    connectionType: 'readiness',
    dataToSend: { leadName: true, sourceCampaign: true, platform: true, qualificationScore: true, consentStatus: true },
    safetyMode: 'prepare_only',
    authorization: { credentials: false, approval: false, testAccount: false, mcpMediation: true, auditRecord: true },
  });

  useEffect(() => {
    if (token) {
      ghlApi.status(token).then(d => setGhlStatus(d as Record<string, unknown>)).catch(console.error);
      leadsApi.list(token).then(d => setLeads(d as Record<string, unknown>[])).catch(console.error);
      ghlApi.wizardOptions(token).catch(console.error);
    }
  }, [token]);

  const handleHandoff = async () => {
    if (!selectedLead || !token) return;
    setLoading(true);
    try {
      const result = await ghlApi.handoff(selectedLead, token);
      setHandoffResult(result as Record<string, unknown>);
      setMessage('Handoff package prepared');
    } catch (err) {
      setMessage(`Failed: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
    setLoading(false);
  };

  const handleSandboxContact = async (mode: 'preview' | 'execute') => {
    if (!selectedLead || !token) return;
    setLoading(true);
    try {
      const result = await ghlApi.sandboxContact({ leadId: selectedLead, mode }, token);
      setHandoffResult(result as Record<string, unknown>);
      setMessage(mode === 'preview' ? 'GHL sandbox contact payload prepared' : 'Sandbox write completed');
    } catch (err) {
      setMessage(`Blocked: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
    setLoading(false);
  };

  const stepIndex = ['connection', 'data', 'safety', 'authorization', 'complete'].indexOf(step);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">GoHighLevel Integration Wizard</h1>
          <p className="text-gray-500 text-sm mt-0.5">Configure CRM integration depth — you choose the level</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={ghlStatus?.configured ? 'success' : 'warning'}>
            {ghlStatus?.configured ? 'Configured' : 'Not Configured'}
          </Badge>
          <Badge variant="blocked">Production Write Disabled</Badge>
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center gap-2">
        {['Connection', 'Data', 'Safety', 'Authorization', 'Complete'].map((s, i) => (
          <div key={s} className="flex items-center">
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${i === stepIndex ? 'bg-blue-600 text-white' : i < stepIndex ? 'bg-green-600/20 text-green-400' : 'bg-gray-800 text-gray-500'}`}>
              {s}
            </div>
            {i < 4 && <div className={`w-8 h-0.5 mx-1 ${i < stepIndex ? 'bg-green-600' : 'bg-gray-700'}`} />}
          </div>
        ))}
      </div>

      {message && <div className="bg-green-900/20 border border-green-800 text-green-400 rounded-lg px-4 py-2 text-sm">{message}</div>}

      {/* Step 1: Connection Type */}
      {step === 'connection' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Step 1 — Connection Type</h2>
          <p className="text-gray-400 text-sm mb-6">Choose how you want to integrate with GoHighLevel</p>
          <div className="space-y-3">
            {CONNECTION_TYPES.map(ct => (
              <button
                key={ct.id}
                onClick={() => setWizardState(s => ({ ...s, connectionType: ct.id }))}
                className={`w-full text-left p-4 rounded-xl border transition-all ${wizardState.connectionType === ct.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-white">{ct.label}</div>
                    <div className="text-sm text-gray-400 mt-1">{ct.description}</div>
                  </div>
                  <Badge variant={ct.risk === 'low' ? 'success' : ct.risk === 'medium' ? 'warning' : 'danger'}>
                    {ct.risk} risk
                  </Badge>
                </div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={() => setStep('data')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Next: Select Data
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Data to Send */}
      {step === 'data' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Step 2 — Data to Send</h2>
          <p className="text-gray-400 text-sm mb-6">Select which fields to include in the handoff package</p>
          <div className="grid grid-cols-2 gap-3">
            {DATA_FIELDS.map(field => (
              <label key={field.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={wizardState.dataToSend[field.id] || false}
                  onChange={e => setWizardState(s => ({ ...s, dataToSend: { ...s.dataToSend, [field.id]: e.target.checked } }))}
                  className="rounded"
                />
                <div>
                  <div className="text-sm text-white">{field.label}</div>
                  {field.required && <div className="text-xs text-gray-500">Required</div>}
                </div>
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('connection')} className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium">
              Back
            </button>
            <button onClick={() => setStep('safety')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Next: Safety Mode
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Safety Mode */}
      {step === 'safety' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Step 3 — Safety Mode</h2>
          <p className="text-gray-400 text-sm mb-6">Choose the safety level for external writes</p>
          <div className="space-y-3">
            {SAFETY_MODES.map(sm => (
              <button
                key={sm.id}
                onClick={() => setWizardState(s => ({ ...s, safetyMode: sm.id }))}
                className={`w-full text-left p-4 rounded-xl border transition-all ${wizardState.safetyMode === sm.id ? 'bg-blue-900/20 border-blue-500/50' : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'}`}
              >
                <div className="font-medium text-white">{sm.label}</div>
                <div className="text-sm text-gray-400 mt-1">{sm.description}</div>
              </button>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('data')} className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium">
              Back
            </button>
            <button onClick={() => setStep('authorization')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Next: Authorization
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Authorization */}
      {step === 'authorization' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Step 4 — Authorization</h2>
          <p className="text-gray-400 text-sm mb-6">Confirm authorization requirements</p>
          <div className="space-y-3">
            {[
              { id: 'credentials', label: 'Requires credentials', description: 'GHL API key must be configured' },
              { id: 'approval', label: 'Requires customer approval', description: 'Human approval before any write' },
              { id: 'testAccount', label: 'Requires test location/account', description: 'Sandbox environment must be available' },
              { id: 'mcpMediation', label: 'Requires MCP mediation', description: 'All access through MCP connector layer' },
              { id: 'auditRecord', label: 'Requires audit record', description: 'All actions logged and audited' },
            ].map(auth => (
              <label key={auth.id} className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={wizardState.authorization[auth.id] || false}
                  onChange={e => setWizardState(s => ({ ...s, authorization: { ...s.authorization, [auth.id]: e.target.checked } }))}
                  className="rounded"
                />
                <div>
                  <div className="text-sm text-white">{auth.label}</div>
                  <div className="text-xs text-gray-500">{auth.description}</div>
                </div>
              </label>
            ))}
          </div>
          <div className="mt-6 flex justify-between">
            <button onClick={() => setStep('safety')} className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium">
              Back
            </button>
            <button onClick={() => setStep('complete')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium">
              Complete Setup
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 'complete' && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-bold text-white mb-4">Integration Configuration Complete</h2>
          <div className="space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Configuration Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Connection Type</span>
                  <span className="text-white">{CONNECTION_TYPES.find(c => c.id === wizardState.connectionType)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Safety Mode</span>
                  <span className="text-white">{SAFETY_MODES.find(s => s.id === wizardState.safetyMode)?.label}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Data Fields</span>
                  <span className="text-white">{Object.values(wizardState.dataToSend).filter(Boolean).length} selected</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Authorization</span>
                  <span className="text-white">{Object.values(wizardState.authorization).filter(Boolean).length} requirements</span>
                </div>
              </div>
            </div>

            {/* Lead Selection */}
            <div className="bg-gray-800/50 rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Select Lead for Handoff</h3>
              <select
                value={selectedLead}
                onChange={e => setSelectedLead(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg p-2 text-white"
              >
                <option value="">Select a lead...</option>
                {leads.map(lead => (
                  <option key={lead.id as string} value={lead.id as string}>
                    {(lead.sourcePlatform as string) || 'Unknown'} — {(lead.leadStatus as string) || 'new'}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleHandoff}
                disabled={!selectedLead || loading}
                className="px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                Handoff Package
              </button>
              <button
                onClick={() => handleSandboxContact('preview')}
                disabled={!selectedLead || loading}
                className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium"
              >
                Preview CRM Payload
              </button>
              <button
                onClick={() => handleSandboxContact('execute')}
                disabled={!selectedLead || loading}
                className="px-4 py-3 bg-rose-600 text-white rounded-lg hover:bg-rose-700 disabled:opacity-50 font-medium"
              >
                Try Sandbox Write
              </button>
            </div>

            {handoffResult && (
              <div className="bg-gray-800/50 rounded-lg p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-medium text-gray-400">Handoff Result</h3>
                  <Badge variant={handoffResult.status === 'blocked' ? 'blocked' : 'success'}>{(handoffResult.status as string) || 'prepared'}</Badge>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-lg bg-gray-900 p-3">
                    <div className="text-xs text-gray-500">Execution</div>
                    <div className="mt-1 text-white">{((handoffResult.safety as Record<string, unknown> | undefined)?.executionPerformed) ? 'Performed' : 'Not performed'}</div>
                  </div>
                  <div className="rounded-lg bg-gray-900 p-3">
                    <div className="text-xs text-gray-500">Endpoint</div>
                    <div className="mt-1 truncate text-white">{(handoffResult.endpoint as string) || 'Prepared internally'}</div>
                  </div>
                  <div className="rounded-lg bg-gray-900 p-3">
                    <div className="text-xs text-gray-500">Label</div>
                    <div className="mt-1 text-white">{(handoffResult._label as string) || 'Prepared'}</div>
                  </div>
                </div>
                {'payload' in handoffResult && (
                  <div className="mt-4 rounded-lg bg-gray-900 p-3">
                    <div className="text-xs font-semibold uppercase tracking-widest text-gray-500">Readable CRM Payload</div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm text-gray-300">
                      {Object.entries((handoffResult.payload as Record<string, unknown>) || {}).slice(0, 8).map(([key, value]) => (
                        <div key={key} className="rounded border border-gray-800 p-2">
                          <span className="block text-xs text-gray-500">{key}</span>
                          <span className="break-words">{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex justify-between">
              <button onClick={() => setStep('authorization')} className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium">
                Back
              </button>
              <button onClick={() => { setStep('connection'); setHandoffResult(null); }} className="px-6 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium">
                Start Over
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
