import { Badge } from '../components/ExecutiveUI';

const leadPackages = [
  { name: 'Lead A', source: 'LinkedIn demo campaign', intent: 'Product interest', score: 82, status: 'Qualified package' },
  { name: 'Lead B', source: 'Instagram demo campaign', intent: 'Follow-up request', score: 74, status: 'Nurture package' },
  { name: 'Lead C', source: 'X/Twitter demo campaign', intent: 'Information request', score: 68, status: 'Review package' },
];

export default function CrmConversion() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Lead Handoff</h1>
          <p className="mt-0.5 text-sm text-slate-500">Lead capture, qualification, and CRM/voice handoff preparation.</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="mock">Demo Data</Badge>
          <Badge variant="blocked">No CRM Writes</Badge>
          <Badge variant="blocked">No WhatsApp / Voice Trigger</Badge>
        </div>
      </div>

      <div className="grid grid-cols-[1.1fr_0.9fr] gap-6">
        <section className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Lead Qualification Packages</h2>
          <div className="mt-4 space-y-3">
            {leadPackages.map(lead => (
              <div key={lead.name} className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-white">{lead.name}</div>
                    <div className="mt-1 text-sm text-slate-400">{lead.source} - {lead.intent}</div>
                  </div>
                  <Badge variant={lead.score >= 80 ? 'success' : 'warning'}>{lead.score}/100</Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Badge variant="info">{lead.status}</Badge>
                  <Badge variant="default">GHL handoff prepared</Badge>
                  <Badge variant="default">Voice/chat package prepared</Badge>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">GoHighLevel Boundary</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              STITCH prepares the CRM handoff package with source, qualification score, intent, and recommended next action.
              The demo does not create contacts, opportunities, tags, messages, or automations in GoHighLevel.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="default">Package only</Badge>
              <Badge variant="blocked">Write blocked</Badge>
              <Badge variant="info">Separate authorization required</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-950/75 p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Voice / Chat Agent Handoff</h2>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              The system can prepare a structured handoff for the existing AI voice/chat agent: lead context, suggested script,
              intent, risk notes, and approval evidence. No call, chat, or WhatsApp message is triggered in this demo.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="default">Handoff package</Badge>
              <Badge variant="blocked">Trigger blocked</Badge>
              <Badge variant="blocked">No real contact</Badge>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
