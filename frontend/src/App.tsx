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
import SmartLabsVoice from './pages/SmartLabsVoice'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-b-blue-600" />
          <span className="text-sm text-gray-500">Loading workspace...</span>
        </div>
      </div>
    )
  }
  if (!token) return <Navigate to="/login" />
  return <ErrorBoundary>{children}</ErrorBoundary>
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/accept-onboarding" element={<AcceptOnboarding />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<DemoCommandCenter />} />
            <Route path="campaigns" element={<CampaignWorkspace />} />
            <Route path="approvals" element={<ApprovalQueue />} />
            <Route path="saif" element={<SaifDecisions />} />
            <Route path="capabilities" element={<CapabilityResolution />} />
            <Route path="mcp" element={<McpMediation />} />
            <Route path="publishing" element={<PublishingPrep />} />
            <Route path="spine" element={<SpineTimeline />} />
            <Route path="observability" element={<Observability />} />
            <Route path="assets" element={<AssetCognition />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="learning" element={<LearningSignals />} />
            <Route path="crm" element={<CrmConversion />} />
            <Route path="production" element={<ProductionRendering />} />
            <Route path="safety" element={<SafetyStatus />} />
            <Route path="ai-settings" element={<AIProviderSettings />} />
            <Route path="my-agent-rep" element={<MyAgentRep />} />
            <Route path="account-security" element={<AccountSecurity />} />
            <Route path="integration-credentials" element={<IntegrationCredentials />} />
            <Route path="admin-users" element={<AdminUsers />} />
            <Route path="tenant-admin" element={<TenantAdmin />} />
            <Route path="operations" element={<OperationsReadiness />} />
            <Route path="smartlabs-voice" element={<SmartLabsVoice />} />
            <Route path="mcp-engine" element={<McpEngine />} />
            <Route path="agent-skills" element={<AgentSkills />} />
            <Route path="ghl-readiness" element={<GhlReadiness />} />
            <Route path="ghl-wizard" element={<GhlWizard />} />
            <Route path="dashboard" element={<DemoCommandCenter />} />
            <Route path="command-center" element={<DemoCommandCenter />} />
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
