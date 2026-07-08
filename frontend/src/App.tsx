import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthProvider'
import { useAuth } from './contexts/useAuth'
import Layout from './components/Layout'
import { ErrorBoundary } from './components/ErrorBoundary'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import CampaignWorkspace from './pages/CampaignWorkspace'
import ApprovalQueue from './pages/ApprovalQueue'
import SaifDecisions from './pages/SaifDecisions'
import CapabilityResolution from './pages/CapabilityResolution'
import McpMediation from './pages/McpMediation'
import PublishingPrep from './pages/PublishingPrep'
import SpineTimeline from './pages/SpineTimeline'
import Observability from './pages/Observability'
import AssetCognition from './pages/AssetCognition'
import Analytics from './pages/Analytics'
import LearningSignals from './pages/LearningSignals'
import CrmConversion from './pages/CrmConversion'
import ProductionRendering from './pages/ProductionRendering'
import SafetyStatus from './pages/SafetyStatus'
import AIProviderSettings from './pages/AIProviderSettings'
import McpEngine from './pages/McpEngine'
import AgentSkills from './pages/AgentSkills'
import GhlReadiness from './pages/GhlReadiness'
import GhlWizard from './pages/GhlWizard'
import DemoCommandCenter from './pages/DemoCommandCenter'
import PostIdeas from './pages/PostIdeas'
import IntegrationCredentials from './pages/IntegrationCredentials'
import AdminUsers from './pages/AdminUsers'
import MyAgentRep from './pages/MyAgentRep'
import AcceptOnboarding from './pages/AcceptOnboarding'
import AccountSecurity from './pages/AccountSecurity'
import TenantAdmin from './pages/TenantAdmin'
import OperationsReadiness from './pages/OperationsReadiness'
import RuntimeInfrastructure from './pages/RuntimeInfrastructure'
import SmartLabsVoice from './pages/SmartLabsVoice'
import SocialGrowthIntelligence from './pages/SocialGrowthIntelligence'
import EventDashboard from './pages/EventDashboard'
import EventStrategyWizard from './pages/EventStrategyWizard'
import MasterEventsDashboard from './pages/MasterEventsDashboard'
import HybridEventWorkspace from './pages/HybridEventWorkspace'
import AieroInspiredPreview from './pages/AieroInspiredPreview'
import Stitchi from './pages/Stitchi'
import CommercialCommandCenter from './pages/CommercialCommandCenter'

const ADMIN_ROLES = ['admin', 'cco']
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
  if (!roles.includes(getUserRole(user))) return <Navigate to="/events" replace />
  return <>{children}</>
}

function adminOnly(element: React.ReactNode) {
  return <RequireRole roles={ADMIN_ROLES}>{element}</RequireRole>
}

function connectorSetup(element: React.ReactNode) {
  return <RequireRole roles={CONNECTOR_SETUP_ROLES}>{element}</RequireRole>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-onboarding" element={<AcceptOnboarding />} />
          <Route path="/ux/aiero-preview" element={<AieroInspiredPreview page="home" />} />
          <Route path="/ux/aiero-preview/events" element={<AieroInspiredPreview page="events" />} />
          <Route path="/ux/aiero-preview/integrations" element={<AieroInspiredPreview page="integrations" />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<CommercialCommandCenter />} />
            <Route path="events/master" element={<MasterEventsDashboard />} />
            <Route path="events" element={<HybridEventWorkspace />} />
            <Route path="events/new" element={<EventStrategyWizard />} />
            <Route path="events/advanced" element={<EventDashboard />} />
            <Route path="events/advanced/:eventId" element={<EventDashboard />} />
            <Route path="events/:eventId" element={<HybridEventWorkspace />} />
            <Route path="stitchi" element={<Stitchi />} />
            <Route path="campaigns" element={<CampaignWorkspace />} />
            <Route path="growth" element={<SocialGrowthIntelligence />} />
            <Route path="approvals" element={<ApprovalQueue />} />
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
            <Route path="command-center" element={<CommercialCommandCenter />} />
            <Route path="content-workflow" element={<DemoCommandCenter />} />
            <Route path="growth-intelligence" element={<SocialGrowthIntelligence />} />
            <Route path="content" element={<PostIdeas />} />
            <Route path="ideas" element={<PostIdeas />} />
            <Route path="draft-studio" element={<PostIdeas />} />
            <Route path="review" element={<ApprovalQueue />} />
            <Route path="scheduling" element={<PublishingPrep />} />
            <Route path="performance" element={<Analytics />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
