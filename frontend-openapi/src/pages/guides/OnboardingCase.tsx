import { Layout } from "../../components/Layout";
import { PageHeader, MetaPill } from "../../components/PageHeader";
import { CodeTabs } from "../../components/CodeTabs";
import { Mermaid } from "../../components/Mermaid";
import { ErrorTable } from "../../components/ErrorTable";
import { NextSteps } from "../../components/NextSteps";
import { EndpointPill } from "../../components/EndpointPill";
import { useEnv } from "../../env";
import { useT } from "../../i18n";

const FLOW = `sequenceDiagram
  participant P as Partner
  participant API as SmartWealth API
  participant DB as Postgres
  P->>API: POST /api/integration/v1/cases
  API->>DB: INSERT case + client + workflow
  API-->>P: 201 caseId, clientId, workflowId
  P->>API: GET /api/integration/v1/cases/:id
  API-->>P: Case payload
`;

export function OnboardingCaseGuide() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.guideOnboarding;

  const TOC = [
    { id: "when", label: p.sec.when, level: 2 as const },
    { id: "diagram", label: p.sec.diagram, level: 2 as const },
    { id: "prereq", label: p.sec.prereq, level: 2 as const },
    { id: "step-1", label: p.sec.step1, level: 2 as const },
    { id: "step-2", label: p.sec.step2, level: 2 as const },
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
            <MetaPill tone="ok">{t.common.minutes(5)}</MetaPill>
            <MetaPill tone="accent">{env.label}</MetaPill>
          </>
        }
      />

      <h2 id="when">{p.sec.when}</h2>
      <p>{p.whenBody}</p>

      <h2 id="diagram">{p.sec.diagram}</h2>
      <Mermaid chart={FLOW} />

      <h2 id="prereq">{p.sec.prereq}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.prereqItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 id="step-1">{p.sec.step1}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/cases" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/cases" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "clientName": "Nguyen Van A", "rmNote": "${t.common.onboarded}" }'`,
          },
          {
            label: "TypeScript",
            language: "tsx",
            code: `const res = await fetch(\`\${BASE}/api/integration/v1/cases\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ clientName: "Nguyen Van A", rmNote: "..." }),
});
const { caseId, clientId, workflowId } = await res.json();`,
          },
          {
            label: "Java",
            language: "java",
            code: `var body = """
{ "clientName": "Nguyen Van A", "rmNote": "..." }
""";
var req = HttpRequest.newBuilder()
    .uri(URI.create(base + "/api/integration/v1/cases"))
    .header("Authorization", "Bearer " + apiKey)
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body))
    .build();`,
          },
          {
            label: `${t.common.response} 201`,
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

      <h2 id="step-2">{p.sec.step2}</h2>
      <p>
        <EndpointPill method="GET" path="/api/integration/v1/cases/{caseId}" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS "${env.baseUrl}/api/integration/v1/cases/$CASE_ID" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx"`,
          },
        ]}
      />

      <h2 id="errors">{p.sec.errors}</h2>
      <ErrorTable rows={p.errors} />

      <NextSteps
        steps={[
          {
            to: "/guides/discovery",
            title: p.nextDiscovery.title,
            description: p.nextDiscovery.desc,
          },
          {
            to: "/guides/discovery-check",
            title: p.nextCheck.title,
            description: p.nextCheck.desc,
          },
        ]}
      />
    </Layout>
  );
}
