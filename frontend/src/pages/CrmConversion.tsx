import { useState } from 'react';
import { Badge } from '../components/ExecutiveUI';

const leadPackages = [
  {
    id: 'lead-linkedin-training',
    name: 'LinkedIn Lead - Enterprise Training Inquiry',
    platform: 'LinkedIn',
    campaign: 'Product Feature Announcement',
    intent: 'Enterprise training inquiry',
    score: 82,
    stage: 'CRM Handoff Prepared',
    owner: 'Commercial Operations',
    approvalStatus: 'Approved for preparation',
    createdAt: '2026-06-24 10:20',
    nextAction: 'Review GHL payload and confirm sandbox authorization',
    reasoning: [
      'Matched enterprise training keywords in campaign response.',
      'High fit with B2B learning and enablement audience.',
      'Clear request for product and pricing information.',
    ],
  },
  {
    id: 'lead-instagram-course',
    name: 'Instagram Lead - Course Follow-up Request',
    platform: 'Instagram',
    campaign: 'Summer Wellness Launch',
    intent: 'Course follow-up request',
    score: 74,
    stage: 'Needs Human Review',
    owner: 'Demand Generation',
    approvalStatus: 'Pending review',
    createdAt: '2026-06-24 10:08',
    nextAction: 'Confirm consent and route to nurture sequence',
    reasoning: [
      'Engaged with course-focused content angle.',
      'Intent is useful but requires consent confirmation.',
      'Recommended for nurture before CRM opportunity creation.',
    ],
  },
  {
    id: 'lead-x-partnership',
    name: 'X Lead - Partnership Information Request',
    platform: 'X/Twitter',
    campaign: 'Product Feature Announcement',
    intent: 'Partnership information request',
    score: 68,
    stage: 'Qualification In Progress',
    owner: 'Revenue Operations',
    approvalStatus: 'Preparation only',
    createdAt: '2026-06-24 09:54',
    nextAction: 'Ask one qualifying question before CRM handoff',
    reasoning: [
      'Partnership intent detected from reply context.',
      'Needs company and role verification before handoff.',
      'Recommended next step is human-reviewed qualification.',
    ],
  },
];

export default function CrmConversion() {
  const [selectedId, setSelectedId] = useState(leadPackages[0].id);
  const selected = leadPackages.find(lead => lead.id === selectedId) || leadPackages[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="success">Lead Intelligence</Badge>
            <Badge variant="info">CRM Handoff Queue</Badge>
            <Badge variant="blocked">External Writes OFF</Badge>
          </div>
          <h1 className="mt-3 text-2xl font-bold text-white">Lead Intelligence Workspace</h1>
          <p className="mt-1 text-sm text-slate-500">
            Qualify campaign leads, review CRM payloads, prepare voice/chat follow-up, and keep execution governed.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-right">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Environment</div>
          <div className="mt-2 flex flex-wrap justify-end gap-2">
            <Badge variant="mock">Sandbox POC</Badge>
            <Badge variant="blocked">GHL write disabled</Badge>
            <Badge variant="blocked">Voice trigger disabled</Badge>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-[380px_1fr] gap-6">
        <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lead Handoff Queue</h2>
            <Badge variant="info">{leadPackages.length} active</Badge>
          </div>
          <div className="mt-4 space-y-3">
            {leadPackages.map(lead => (
              <button
                key={lead.id}
                onClick={() => setSelectedId(lead.id)}
                className={`w-full rounded-lg border p-4 text-left transition ${selected.id === lead.id ? 'border-sky-400 bg-sky-500/15' : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{lead.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{lead.platform} - {lead.intent}</div>
                  </div>
                  <Badge variant={lead.score >= 80 ? 'success' : 'warning'}>{lead.score}/100</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="info">{lead.stage}</Badge>
                  <Badge variant="default">{lead.owner}</Badge>
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">{selected.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{selected.campaign} - {selected.platform}</p>
              </div>
              <Badge variant={selected.score >= 80 ? 'success' : 'warning'}>Qualification {selected.score}/100</Badge>
            </div>

            <div className="mt-5 grid grid-cols-4 gap-3">
              <Info label="Current Stage" value={selected.stage} />
              <Info label="Owner" value={selected.owner} />
              <Info label="Approval Status" value={selected.approvalStatus} />
              <Info label="Created" value={selected.createdAt} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-4">
              <ReadablePanel title="Qualification Reasoning" items={selected.reasoning} />
              <ReadablePanel title="Recommended Next Action" items={[selected.nextAction, 'Human review remains required before any external write or voice/chat trigger.']} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <PayloadPanel
              title="GHL Contact / Opportunity Payload"
              status="Requires Credentials"
              items={[
                `Contact source: ${selected.platform}`,
                `Campaign attribution: ${selected.campaign}`,
                `Intent: ${selected.intent}`,
                `Qualification score: ${selected.score}`,
                'Opportunity pipeline: Commercial/Social POC',
                `Stage: ${selected.stage}`,
              ]}
            />
            <PayloadPanel
              title="Voice/Chat Follow-up Payload"
              status="Requires Authorization"
              items={[
                `Lead context: ${selected.intent}`,
                `Campaign source: ${selected.campaign}`,
                `Suggested intent: Confirm interest and route to human owner`,
                'Script: Hi, this is a sandbox-approved follow-up about your inquiry. Is this a good time to continue?',
                `Consent status: ${selected.approvalStatus.includes('Approved') ? 'reviewed' : 'pending review'}`,
              ]}
            />
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Governed Actions</h2>
            <div className="mt-4 grid grid-cols-4 gap-3">
              <Action label="Approve Handoff Preparation" enabled />
              <Action label="View GHL Payload" enabled />
              <Action label="Push to GHL" reason="Sandbox flag OFF" />
              <Action label="Trigger Voice/Chat" reason="Requires approved test lead" />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-medium text-slate-200">{value}</div>
    </div>
  );
}

function ReadablePanel({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</div>
      <div className="mt-3 space-y-2">
        {items.map(item => (
          <div key={item} className="flex gap-2 text-sm leading-5 text-slate-300">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-400" />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PayloadPanel({ title, status, items }: { title: string; status: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">{title}</h2>
        <Badge variant="warning">{status}</Badge>
      </div>
      <div className="mt-4">
        <ReadablePanel title="Payload Preview" items={items} />
      </div>
    </div>
  );
}

function Action({ label, enabled, reason }: { label: string; enabled?: boolean; reason?: string }) {
  return (
    <button
      disabled={!enabled}
      className={enabled
        ? 'rounded-lg bg-sky-600 px-4 py-3 text-sm font-semibold text-white hover:bg-sky-500'
        : 'rounded-lg border border-slate-700 px-4 py-3 text-sm font-semibold text-slate-500'}
      title={reason}
    >
      <span>{label}</span>
      {!enabled && reason && <span className="mt-1 block text-[11px] font-normal text-slate-600">{reason}</span>}
    </button>
  );
}
