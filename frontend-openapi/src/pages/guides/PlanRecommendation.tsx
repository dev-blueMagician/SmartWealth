import { Layout } from "../../components/Layout";
import { PageHeader, MetaPill } from "../../components/PageHeader";
import { CodeTabs } from "../../components/CodeTabs";
import { Mermaid } from "../../components/Mermaid";
import { NextSteps } from "../../components/NextSteps";
import { EndpointPill } from "../../components/EndpointPill";
import { useEnv } from "../../env";
import { useT } from "../../i18n";

const FLOW = `sequenceDiagram
  participant P as Partner
  participant API as SmartWealth API
  participant AI as AI-engine
  P->>API: POST /clients/:id/plans (note)
  API-->>P: 201 plan + version 1
  P->>API: POST /plans/:id/draft (scenarioKey, assumptions)
  API->>AI: compute draft
  AI-->>API: snapshot
  API-->>P: 200
  P->>API: GET /plans/:planVersionId/recommendations
  API-->>P: list of recommendations
`;

export function PlanRecommendationGuide() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.guidePlanRec;

  const TOC = [
    { id: "diagram", label: p.sec.diagram, level: 2 as const },
    { id: "create", label: p.sec.create, level: 2 as const },
    { id: "draft", label: p.sec.draft, level: 2 as const },
    { id: "recs", label: p.sec.recs, level: 2 as const },
    { id: "create-rec", label: p.sec.createRec, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={<MetaPill tone="accent">{env.label}</MetaPill>}
      />

      <h2 id="diagram">{p.sec.diagram}</h2>
      <Mermaid chart={FLOW} />

      <h2 id="create">{p.sec.create}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/clients/{clientId}/plans" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/clients/$CLIENT_ID/plans" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "note": "Initial plan after onboarding" }'`,
          },
          {
            label: t.common.response,
            language: "json",
            code: `{
  "id": "...",
  "clientId": "...",
  "status": "DRAFT",
  "versionNo": 1,
  "approved": false,
  "createdAt": "2026-05-10T08:45:00Z"
}`,
          },
        ]}
      />

      <h2 id="draft">{p.sec.draft}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/plans/{planId}/draft" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/plans/$PLAN_ID/draft" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "scenarioKey": "BASE",
    "assumptions": {
      "inflationRate": 0.04,
      "expectedReturn": 0.08
    }
  }'`,
          },
        ]}
      />

      <h2 id="recs">{p.sec.recs}</h2>
      <p>
        <EndpointPill method="GET" path="/api/integration/v1/plans/{planVersionId}/recommendations" />
      </p>
      <CodeTabs
        samples={[
          {
            label: t.common.response,
            language: "json",
            code: `[
  {
    "id": "rec_01...",
    "planVersionId": "...",
    "recType": "REBALANCE",
    "summary": "Increase equity allocation 30% → 45%.",
    "createdAt": "2026-05-10T08:50:00Z"
  }
]`,
          },
        ]}
      />

      <h2 id="create-rec">{p.sec.createRec}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/plans/{planVersionId}/recommendations" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/plans/$PLAN_VERSION_ID/recommendations" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "recType": "INCREASE_SAVINGS", "summary": "Increase periodic savings by 10%." }'`,
          },
        ]}
      />

      <NextSteps
        steps={[
          {
            to: "/guides/decision-execution",
            title: p.nextDecision.title,
            description: p.nextDecision.desc,
          },
        ]}
      />
    </Layout>
  );
}
