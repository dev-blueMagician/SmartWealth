import { Navigate, Route, Routes } from "react-router-dom";
import { OverviewPage } from "./pages/Overview";
import { AuthenticationPage } from "./pages/Authentication";
import { QuickstartPage } from "./pages/Quickstart";
import { OnboardingCaseGuide } from "./pages/guides/OnboardingCase";
import { DiscoveryGuide } from "./pages/guides/Discovery";
import { DiscoveryCheckGuide } from "./pages/guides/DiscoveryCheck";
import { PlanRecommendationGuide } from "./pages/guides/PlanRecommendation";
import { DecisionExecutionGuide } from "./pages/guides/DecisionExecution";
import { AiCatalogGuide } from "./pages/guides/AiCatalog";
import { ChatChannelGuide } from "./pages/guides/ChatChannel";
import { CaseWorkflowConcept } from "./pages/concepts/CaseWorkflow";
import { CatalogSsotConcept } from "./pages/concepts/CatalogSsot";
import { IdempotencyConcept } from "./pages/concepts/Idempotency";
import { ApiReferencePage } from "./pages/ApiReference";
import { WebhooksPage } from "./pages/Webhooks";
import { ErrorsPage } from "./pages/Errors";
import { ChangelogPage } from "./pages/Changelog";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<OverviewPage />} />
      <Route path="/authentication" element={<AuthenticationPage />} />
      <Route path="/quickstart" element={<QuickstartPage />} />

      <Route path="/guides/onboarding-case" element={<OnboardingCaseGuide />} />
      <Route path="/guides/discovery" element={<DiscoveryGuide />} />
      <Route path="/guides/discovery-check" element={<DiscoveryCheckGuide />} />
      <Route path="/guides/plan-recommendation" element={<PlanRecommendationGuide />} />
      <Route path="/guides/decision-execution" element={<DecisionExecutionGuide />} />
      <Route path="/guides/ai-catalog" element={<AiCatalogGuide />} />
      <Route path="/guides/chat-channel" element={<ChatChannelGuide />} />

      <Route path="/concepts/case-workflow" element={<CaseWorkflowConcept />} />
      <Route path="/concepts/catalog-ssot" element={<CatalogSsotConcept />} />
      <Route path="/concepts/idempotency" element={<IdempotencyConcept />} />

      <Route path="/api-reference" element={<ApiReferencePage />} />
      <Route path="/webhooks" element={<WebhooksPage />} />
      <Route path="/errors" element={<ErrorsPage />} />
      <Route path="/changelog" element={<ChangelogPage />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
