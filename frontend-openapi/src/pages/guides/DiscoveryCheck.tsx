import { Layout } from "../../components/Layout";
import { PageHeader, MetaPill } from "../../components/PageHeader";
import { CodeTabs } from "../../components/CodeTabs";
import { Callout } from "../../components/Callout";
import { Mermaid } from "../../components/Mermaid";
import { ErrorTable } from "../../components/ErrorTable";
import { NextSteps } from "../../components/NextSteps";
import { EndpointPill } from "../../components/EndpointPill";
import { useEnv } from "../../env";
import { useT } from "../../i18n";

const FLOW = `sequenceDiagram
  participant P as Partner
  participant API as SmartWealth API
  participant AI as AI-engine
  participant DB as Postgres
  P->>API: POST /cases/:id/discovery/check
  API->>AI: invoke onboarding_completeness assessment
  AI->>DB: read snapshot (assets, goals, profile)
  AI-->>API: ai_result + findings
  API-->>P: 200 caseStatus + missingFields
  API-->>P: webhook case.discovery.ready (async)
`;

export function DiscoveryCheckGuide() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.guideDiscoveryCheck;

  const TOC = [
    { id: "when", label: p.sec.when, level: 2 as const },
    { id: "diagram", label: p.sec.diagram, level: 2 as const },
    { id: "trigger", label: p.sec.trigger, level: 2 as const },
    { id: "ready", label: p.sec.ready, level: 2 as const },
    { id: "missing", label: p.sec.missing, level: 2 as const },
    { id: "errors", label: p.sec.errors, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={
          <>
            <MetaPill tone="accent">onboarding_completeness</MetaPill>
            <MetaPill>{t.common.idempotent}</MetaPill>
            <MetaPill tone="ok">{env.label}</MetaPill>
          </>
        }
      />

      <h2 id="when">{p.sec.when}</h2>
      <p>{p.whenBody}</p>

      <h2 id="diagram">{p.sec.diagram}</h2>
      <Mermaid chart={FLOW} />

      <h2 id="trigger">{p.sec.trigger}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/cases/{caseId}/discovery/check" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/cases/$CASE_ID/discovery/check" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx"`,
          },
          {
            label: "TypeScript",
            language: "tsx",
            code: `const r = await fetch(\`\${BASE}/api/integration/v1/cases/\${caseId}/discovery/check\`, {
  method: "POST",
  headers: { Authorization: \`Bearer \${apiKey}\` },
});
const result = await r.json();
if (result.caseStatus === "READY") {
  // proceed to plan creation
}`,
          },
        ]}
      />

      <h2 id="ready">{p.sec.ready}</h2>
      <CodeTabs
        samples={[
          {
            label: t.common.response,
            language: "json",
            code: `{
  "caseStatus": "READY",
  "missingFields": [],
  "assessmentCode": "onboarding_completeness"
}`,
          },
        ]}
      />

      <h2 id="missing">{p.sec.missing}</h2>
      <CodeTabs
        samples={[
          {
            label: t.common.response,
            language: "json",
            code: `{
  "caseStatus": "MISSING_DATA",
  "missingFields": [
    "client.profile.dependents",
    "asset.realestate"
  ],
  "assessmentCode": "onboarding_completeness"
}`,
          },
        ]}
      />
      <Callout tone="info">{p.missingNote}</Callout>

      <h2 id="errors">{p.sec.errors}</h2>
      <ErrorTable rows={p.errors} />

      <NextSteps
        steps={[
          {
            to: "/guides/plan-recommendation",
            title: p.nextPlan.title,
            description: p.nextPlan.desc,
          },
          {
            to: "/webhooks",
            title: p.nextWebhook.title,
            description: p.nextWebhook.desc,
          },
        ]}
      />
    </Layout>
  );
}
