import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
