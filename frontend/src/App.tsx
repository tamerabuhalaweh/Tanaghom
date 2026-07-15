import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'

const Login = lazy(() => import('./pages/Login'))
const NotFound = lazy(() => import('./pages/NotFound'))
const CampaignWorkspace = lazy(() => import('./pages/CampaignWorkspace'))
const ApprovalQueue = lazy(() => import('./pages/ApprovalQueue'))
const SaifDecisions = lazy(() => import('./pages/SaifDecisions'))
const CapabilityResolution = lazy(() => import('./pages/CapabilityResolution'))
const McpMediation = lazy(() => import('./pages/McpMediation'))
const PublishingPrep = lazy(() => import('./pages/PublishingPrep'))
const SpineTimeline = lazy(() => import('./pages/SpineTimeline'))
const Observability = lazy(() => import('./pages/Observability'))
const AssetCognition = lazy(() => import('./pages/AssetCognition'))
const Analytics = lazy(() => import('./pages/Analytics'))
const LearningSignals = lazy(() => import('./pages/LearningSignals'))
const CrmConversion = lazy(() => import('./pages/CrmConversion'))
const ProductionRendering = lazy(() => import('./pages/ProductionRendering'))
const SafetyStatus = lazy(() => import('./pages/SafetyStatus'))
const AIProviderSettings = lazy(() => import('./pages/AIProviderSettings'))
const McpEngine = lazy(() => import('./pages/McpEngine'))
const AgentSkills = lazy(() => import('./pages/AgentSkills'))
const GhlReadiness = lazy(() => import('./pages/GhlReadiness'))
const GhlWizard = lazy(() => import('./pages/GhlWizard'))
const DemoCommandCenter = lazy(() => import('./pages/DemoCommandCenter'))
const PostIdeas = lazy(() => import('./pages/PostIdeas'))
const IntegrationCredentials = lazy(() => import('./pages/IntegrationCredentials'))
const AdminUsers = lazy(() => import('./pages/AdminUsers'))
const MyAgentRep = lazy(() => import('./pages/MyAgentRep'))
const AcceptOnboarding = lazy(() => import('./pages/AcceptOnboarding'))
const AccountSecurity = lazy(() => import('./pages/AccountSecurity'))
const TenantAdmin = lazy(() => import('./pages/TenantAdmin'))
const OperationsReadiness = lazy(() => import('./pages/OperationsReadiness'))
const RuntimeInfrastructure = lazy(() => import('./pages/RuntimeInfrastructure'))
const SmartLabsVoice = lazy(() => import('./pages/SmartLabsVoice'))
const SocialGrowthIntelligence = lazy(() => import('./pages/SocialGrowthIntelligence'))
const EventDashboard = lazy(() => import('./pages/EventDashboard'))
const EventStrategyWizard = lazy(() => import('./pages/EventStrategyWizard'))
const MasterEventsDashboard = lazy(() => import('./pages/MasterEventsDashboard'))
const HybridEventWorkspace = lazy(() => import('./pages/HybridEventWorkspace'))
const AieroInspiredPreview = lazy(() => import('./pages/AieroInspiredPreview'))
const Stitchi = lazy(() => import('./pages/Stitchi'))
const CommercialCommandCenter = lazy(() => import('./pages/CommercialCommandCenter'))
const CommercialAssessment = lazy(() => import('./pages/CommercialAssessment'))
const CommercialDisciplines = lazy(() => import('./pages/CommercialDisciplines'))
const ExecutiveDashboard = lazy(() => import('./pages/ExecutiveDashboard'))
const CommercialToday = lazy(() => import('./pages/CommercialToday'))
const UXR1D3Reference = lazy(() => import('./pages/UXR1D3Reference'))

const ADMIN_ROLES = ['admin', 'cco']
const EXECUTIVE_ROLES = ['admin', 'cco']
const APPROVAL_READ_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer']
const CONNECTOR_SETUP_ROLES = ['admin', 'cco', 'department_head', 'marketing_manager']

function LoadingWorkspace() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-b-blue-600" />
        <span className="text-sm text-gray-500">Loading workspace...</span>
      </div>
    </div>
  )
}

function normalizeRole(role: string): string {
  return role.trim().toLowerCase().replaceAll(' ', '_').replaceAll('-', '_')
}

function getUserRole(user: unknown): string {
  if (!user || typeof user !== 'object') return 'unknown'
  const role = (user as Record<string, unknown>).role
  return typeof role === 'string' && role.trim() ? normalizeRole(role) : 'unknown'
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) {
    return <LoadingWorkspace />
  }
  if (!token) return <Navigate to="/login" />
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function RequireRole({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingWorkspace />
  if (!roles.includes(getUserRole(user))) return <Navigate to="/command-center" replace />
  return <>{children}</>
}

function adminOnly(element: React.ReactNode) {
  return <RequireRole roles={ADMIN_ROLES}>{element}</RequireRole>
}

function executiveOnly(element: React.ReactNode) {
  return <RequireRole roles={EXECUTIVE_ROLES}>{element}</RequireRole>
}

function approvalRead(element: React.ReactNode) {
  return <RequireRole roles={APPROVAL_READ_ROLES}>{element}</RequireRole>
}

function connectorSetup(element: React.ReactNode) {
  return <RequireRole roles={CONNECTOR_SETUP_ROLES}>{element}</RequireRole>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingWorkspace />}>
          <Routes>
            <Route path="/login" element={<Login />} />
          <Route path="/accept-onboarding" element={<AcceptOnboarding />} />
          <Route path="/ux/aiero-preview" element={<AieroInspiredPreview page="home" />} />
          <Route path="/ux/aiero-preview/events" element={<AieroInspiredPreview page="events" />} />
          <Route path="/ux/aiero-preview/integrations" element={<AieroInspiredPreview page="integrations" />} />
          <Route path="/ux/r1d3/content" element={<UXR1D3Reference page="content" />} />
          <Route path="/ux/r1d3/review" element={<UXR1D3Reference page="review" />} />
          <Route path="/ux/r1d3/scheduling" element={<UXR1D3Reference page="scheduling" />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<CommercialToday />} />
            <Route path="events/master" element={<MasterEventsDashboard />} />
            <Route path="events" element={<HybridEventWorkspace />} />
            <Route path="events/new" element={<EventStrategyWizard />} />
            <Route path="events/advanced" element={<EventDashboard />} />
            <Route path="events/advanced/:eventId" element={<EventDashboard />} />
            <Route path="events/:eventId" element={<HybridEventWorkspace />} />
            <Route path="stitchi" element={<Stitchi />} />
            <Route path="executive" element={executiveOnly(<ExecutiveDashboard />)} />
            <Route path="disciplines" element={<CommercialDisciplines />} />
            <Route path="campaigns" element={<CampaignWorkspace />} />
            <Route path="growth" element={<SocialGrowthIntelligence />} />
            <Route path="approvals" element={approvalRead(<ApprovalQueue />)} />
            <Route path="saif" element={adminOnly(<SaifDecisions />)} />
            <Route path="capabilities" element={adminOnly(<CapabilityResolution />)} />
            <Route path="mcp" element={adminOnly(<McpMediation />)} />
            <Route path="publishing" element={<PublishingPrep />} />
            <Route path="spine" element={adminOnly(<SpineTimeline />)} />
            <Route path="observability" element={adminOnly(<Observability />)} />
            <Route path="assets" element={adminOnly(<AssetCognition />)} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="learning" element={adminOnly(<LearningSignals />)} />
            <Route path="crm" element={adminOnly(<CrmConversion />)} />
            <Route path="production" element={adminOnly(<ProductionRendering />)} />
            <Route path="safety" element={adminOnly(<SafetyStatus />)} />
            <Route path="ai-settings" element={<AIProviderSettings />} />
            <Route path="my-agent-rep" element={<MyAgentRep />} />
            <Route path="account-security" element={<AccountSecurity />} />
            <Route path="integration-credentials" element={connectorSetup(<IntegrationCredentials />)} />
            <Route path="admin-users" element={adminOnly(<AdminUsers />)} />
            <Route path="tenant-admin" element={adminOnly(<TenantAdmin />)} />
            <Route path="operations" element={adminOnly(<OperationsReadiness />)} />
            <Route path="runtime-infrastructure" element={adminOnly(<RuntimeInfrastructure />)} />
            <Route path="smartlabs-voice" element={connectorSetup(<SmartLabsVoice />)} />
            <Route path="mcp-engine" element={adminOnly(<McpEngine />)} />
            <Route path="agent-skills" element={adminOnly(<AgentSkills />)} />
            <Route path="ghl-readiness" element={adminOnly(<GhlReadiness />)} />
            <Route path="ghl-wizard" element={connectorSetup(<GhlWizard />)} />
            <Route path="dashboard" element={<MasterEventsDashboard />} />
            <Route path="command-center" element={<CommercialToday />} />
            <Route path="commercial-plans" element={<CommercialCommandCenter />} />
            <Route path="commercial-assessment" element={<CommercialAssessment />} />
            <Route path="ceo-dashboard" element={executiveOnly(<ExecutiveDashboard />)} />
            <Route path="content-workflow" element={<DemoCommandCenter />} />
            <Route path="growth-intelligence" element={<SocialGrowthIntelligence />} />
            <Route path="content" element={<PostIdeas />} />
            <Route path="ideas" element={<PostIdeas />} />
            <Route path="draft-studio" element={<PostIdeas />} />
            <Route path="review" element={approvalRead(<ApprovalQueue />)} />
            <Route path="scheduling" element={<PublishingPrep />} />
            <Route path="performance" element={<Analytics />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
