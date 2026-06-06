import { Layout } from "../../components/Layout";
import { PageHeader, MetaPill } from "../../components/PageHeader";
import { CodeTabs } from "../../components/CodeTabs";
import { Mermaid } from "../../components/Mermaid";
import { EndpointPill } from "../../components/EndpointPill";
import { useEnv } from "../../env";
import { useT } from "../../i18n";

const FLOW = `flowchart LR
  P[Partner] -->|GET /ai-catalog/case-phases| API[SmartWealth API]
  API --> DB[("Postgres<br/>case_phase + ai_interaction")]
  DB --> API
  API --> P
`;

export function AiCatalogGuide() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.guideAiCatalog;

  const TOC = [
    { id: "what", label: p.sec.what, level: 2 as const },
    { id: "diagram", label: p.sec.diagram, level: 2 as const },
    { id: "list", label: p.sec.list, level: 2 as const },
    { id: "phase", label: p.sec.phase, level: 2 as const },
    { id: "shape", label: p.sec.shape, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={
          <>
            <MetaPill tone="ok">{t.common.readonly}</MetaPill>
            <MetaPill>{env.label}</MetaPill>
          </>
        }
      />

      <h2 id="what">{p.sec.what}</h2>
      <p>{p.whatBody}</p>

      <h2 id="diagram">{p.sec.diagram}</h2>
      <Mermaid chart={FLOW} />

      <h2 id="list">{p.sec.list}</h2>
      <p>
        <EndpointPill method="GET" path="/api/integration/v1/ai-catalog/case-phases" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS "${env.baseUrl}/api/integration/v1/ai-catalog/case-phases" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx"`,
          },
          {
            label: "Filter phase",
            language: "bash",
            code: `curl -sS "${env.baseUrl}/api/integration/v1/ai-catalog/case-phases?case_phase=ONBOARDING" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx"`,
          },
        ]}
      />

      <h2 id="phase">{p.sec.phase}</h2>
      <p>
        <EndpointPill method="GET" path="/api/integration/v1/ai-catalog/case-phases/{phaseCode}" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS "${env.baseUrl}/api/integration/v1/ai-catalog/case-phases/ONBOARDING" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx"`,
          },
        ]}
      />

      <h2 id="shape">{p.sec.shape}</h2>
      <CodeTabs
        samples={[
          {
            label: t.common.response,
            language: "json",
            code: `{
  "version": "2026.05.10-1",
  "phase_order": ["ONBOARDING", "DISCOVERY", "PLANNING", "EXECUTION"],
  "phases": {
    "ONBOARDING": [
      {
        "assessmentCode": "onboarding_completeness",
        "intent": "Onboarding completeness check",
        "aiType": "loop_eval",
        "humanInTheLoop": false
      }
    ],
    "PLANNING": [
      {
        "assessmentCode": "assessment_12",
        "intent": "Risk profiling assistant",
        "aiType": "advisory",
        "humanInTheLoop": true
      }
    ]
  }
}`,
          },
        ]}
      />
    </Layout>
  );
}
