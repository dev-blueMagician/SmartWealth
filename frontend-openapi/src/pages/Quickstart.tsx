import { Layout } from "../components/Layout";
import { PageHeader, MetaPill } from "../components/PageHeader";
import { CodeTabs } from "../components/CodeTabs";
import { Callout } from "../components/Callout";
import { Mermaid } from "../components/Mermaid";
import { NextSteps } from "../components/NextSteps";
import { useEnv } from "../env";
import { useT } from "../i18n";

const FLOW = `sequenceDiagram
  participant P as Partner
  participant API as SmartWealth API
  participant AI as AI-engine
  P->>API: 1. POST /cases
  API-->>P: 201 caseId, clientId
  P->>API: 2. POST /clients/:id/assets, goals
  P->>API: 3. POST /cases/:id/discovery/check
  API->>AI: trigger onboarding_completeness (internal)
  AI-->>API: ai_result + findings
  API-->>P: 200 caseStatus = READY|MISSING_DATA
  API-->>P: webhook case.discovery.ready
`;

export function QuickstartPage() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.quickstart;

  const TOC = [
    { id: "step-1", label: p.sec.step1, level: 2 as const },
    { id: "step-2", label: p.sec.step2, level: 2 as const },
    { id: "step-3", label: p.sec.step3, level: 2 as const },
    { id: "step-4", label: p.sec.step4, level: 2 as const },
    { id: "step-5", label: p.sec.step5, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={
          <>
            <MetaPill tone="ok">{t.common.minutes(10)}</MetaPill>
            <MetaPill tone="accent">{env.label}</MetaPill>
          </>
        }
      />

      <Mermaid chart={FLOW} caption={p.flowCaption} />

      <h2 id="step-1">{p.sec.step1}</h2>
      <p>
        {p.step1Intro}
        <em>{p.step1Action}</em>
        {p.step1After}
        <code>{env.tokenPrefix}…</code>
        {p.step1Final}
      </p>
      <CodeTabs
        samples={[
          {
            label: "shell",
            language: "bash",
            code: `export SMARTWEALTH_BASE="${env.baseUrl}"
export SMARTWEALTH_API_KEY="${env.tokenPrefix}xxxxxxxxxxxx"`,
          },
        ]}
      />

      <h2 id="step-2">{p.sec.step2}</h2>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "$SMARTWEALTH_BASE/api/integration/v1/cases" \\
  -H "Authorization: Bearer $SMARTWEALTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "clientName": "Nguyen Van A",
    "rmNote": "${t.common.onboarded}"
  }'`,
          },
          {
            label: t.common.response,
            language: "json",
            code: `{
  "caseId": "0a1b2c3d-...",
  "clientId": "9f8e7d6c-...",
  "workflowId": "33333333-...",
  "phase": "ONBOARDING",
  "status": "INITIALIZED",
  "createdAt": "2026-05-10T08:30:00Z"
}`,
          },
        ]}
      />

      <h2 id="step-3">{p.sec.step3}</h2>
      <CodeTabs
        samples={[
          {
            label: "Assets",
            language: "bash",
            code: `curl -sS -X POST "$SMARTWEALTH_BASE/api/integration/v1/clients/$CLIENT_ID/assets" \\
  -H "Authorization: Bearer $SMARTWEALTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "assetType": "CASH", "value": 1000000000 }'`,
          },
          {
            label: "Goals",
            language: "bash",
            code: `curl -sS -X POST "$SMARTWEALTH_BASE/api/integration/v1/clients/$CLIENT_ID/goals" \\
  -H "Authorization: Bearer $SMARTWEALTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "goalType": "RETIREMENT", "targetAmount": 5000000000 }'`,
          },
          {
            label: "Profile",
            language: "bash",
            code: `curl -sS -X PUT "$SMARTWEALTH_BASE/api/integration/v1/clients/$CLIENT_ID/profile" \\
  -H "Authorization: Bearer $SMARTWEALTH_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{ "age": 45, "riskTolerance": "MEDIUM", "incomeMonthly": 80000000 }'`,
          },
        ]}
      />

      <h2 id="step-4">{p.sec.step4}</h2>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "$SMARTWEALTH_BASE/api/integration/v1/cases/$CASE_ID/discovery/check" \\
  -H "Authorization: Bearer $SMARTWEALTH_API_KEY"`,
          },
          {
            label: "READY",
            language: "json",
            code: `{
  "caseStatus": "READY",
  "missingFields": [],
  "assessmentCode": "onboarding_completeness"
}`,
          },
          {
            label: "MISSING_DATA",
            language: "json",
            code: `{
  "caseStatus": "MISSING_DATA",
  "missingFields": ["client.profile.dependents", "asset.realestate"],
  "assessmentCode": "onboarding_completeness"
}`,
          },
        ]}
      />
      <Callout tone="info" title={p.idempotentTitle}>
        {p.idempotentNote}
      </Callout>

      <h2 id="step-5">{p.sec.step5}</h2>
      <CodeTabs
        samples={[
          {
            label: t.common.payload,
            language: "json",
            code: `{
  "id": "evt_01HZ...",
  "type": "case.discovery.ready",
  "createdAt": "2026-05-10T08:32:14Z",
  "data": {
    "caseId": "0a1b2c3d-...",
    "clientId": "9f8e7d6c-...",
    "status": "READY"
  }
}`,
          },
          {
            label: t.common.headers,
            language: "http",
            code: `POST /your/webhook HTTP/1.1
Content-Type: application/json
X-SmartWealth-Event: case.discovery.ready
X-SmartWealth-Signature: t=1715332334,v1=5d41402abc4b...`,
          },
        ]}
      />

      <NextSteps
        steps={[
          {
            to: "/guides/plan-recommendation",
            title: p.nextOnboardingTitle,
            description: p.nextOnboardingDesc,
          },
          {
            to: "/webhooks",
            title: p.nextWebhookTitle,
            description: p.nextWebhookDesc,
          },
        ]}
      />
    </Layout>
  );
}
