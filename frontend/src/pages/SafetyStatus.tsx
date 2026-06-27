import { Notice, ProductCard, ProductPage, ProductStatus, ReadableQueue } from '../components/ProductUI';

export default function SafetyStatus() {
  const gates = [
    { name: 'Social Publishing', description: 'Publishing to social platforms requires approval and admin setup.', status: 'Controlled' },
    { name: 'Media Generation', description: 'Image and video generation is disabled.', status: 'Controlled' },
    { name: 'Customer Messaging', description: 'No messages sent to customers without admin setup.', status: 'Controlled' },
    { name: 'Scheduling Service', description: 'Scheduling requires a selected channel and admin configuration.', status: 'Controlled' },
    { name: 'CRM Connection', description: 'Customer record handoff is preview-only.', status: 'Controlled' },
    { name: 'Asset Library', description: 'External media library access is disabled.', status: 'Controlled' },
    { name: 'External API Calls', description: 'No real API integrations are active.', status: 'Controlled' },
    { name: 'File Upload', description: 'No file system writes are permitted.', status: 'Controlled' },
    { name: 'Secret Storage', description: 'Credentials are encrypted and never exposed.', status: 'Protected' },
    { name: 'Customer Data', description: 'No real customer data is stored.', status: 'Protected' },
  ];

  return (
    <ProductPage
      eyebrow="System"
      title="Safety & Security"
      subtitle="All external actions are controlled by default. Nothing can publish or send without admin authorization."
      action={<ProductStatus tone="good">System Protected</ProductStatus>}
    >
      <Notice tone="good">
        This platform is safe for controlled pilot use. External actions stay controlled unless an admin explicitly configures and authorizes them.
      </Notice>

      <ProductCard title="Safety Controls" subtitle="Each feature is off by default. An admin enables features when your team is ready.">
        <ReadableQueue
          items={gates.map((gate) => ({
            title: gate.name,
            meta: gate.description,
            status: gate.status,
            tone: gate.status === 'Protected' ? 'good' as const : 'info' as const,
          }))}
        />
      </ProductCard>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-green-200 bg-green-50 p-5">
          <h3 className="font-semibold text-green-900">What's Protected</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-green-800">
            <li>No publishing without approval</li>
            <li>No auto-scheduling of real posts</li>
            <li>No social account action without channel setup</li>
            <li>No automated messages to users</li>
            <li>No CRM writes without authorization</li>
            <li>No voice or chat outreach without setup</li>
            <li>All API keys are encrypted</li>
          </ul>
        </div>
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-5">
          <h3 className="font-semibold text-blue-900">When You're Ready</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-blue-800">
            <li>An admin configures the scheduling service</li>
            <li>An admin sets up CRM connections</li>
            <li>An admin enables customer messaging</li>
            <li>All actions are logged and auditable</li>
            <li>Human approval is required before any external action</li>
            <li>You can always roll back or disable features</li>
          </ul>
        </div>
      </div>
    </ProductPage>
  );
}
