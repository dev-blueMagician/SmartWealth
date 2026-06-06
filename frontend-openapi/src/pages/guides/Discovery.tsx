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
  P->>API: POST /clients/:id/assets (n times)
  P->>API: POST /clients/:id/goals (n times)
  P->>API: PUT  /clients/:id/profile
  API-->>P: 200/201 per request
`;

export function DiscoveryGuide() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.guideDiscovery;

  const TOC = [
    { id: "when", label: p.sec.when, level: 2 as const },
    { id: "diagram", label: p.sec.diagram, level: 2 as const },
    { id: "assets", label: p.sec.assets, level: 2 as const },
    { id: "goals", label: p.sec.goals, level: 2 as const },
    { id: "profile", label: p.sec.profile, level: 2 as const },
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
            <MetaPill tone="accent">{env.label}</MetaPill>
            <MetaPill>{t.common.idempotent}</MetaPill>
          </>
        }
      />

      <h2 id="when">{p.sec.when}</h2>
      <p>{p.whenBody}</p>

      <h2 id="diagram">{p.sec.diagram}</h2>
      <Mermaid chart={FLOW} />

      <h2 id="assets">{p.sec.assets}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/clients/{clientId}/assets" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/clients/$CLIENT_ID/assets" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "assetType": "CASH", "value": 1000000000 }'`,
          },
          {
            label: "Bulk",
            language: "bash",
            code: `for type in CASH BOND EQUITY REALESTATE; do
  curl -sS -X POST "$BASE/api/integration/v1/clients/$CLIENT_ID/assets" \\
    -H "Authorization: Bearer $KEY" \\
    -H "Content-Type: application/json" \\
    -d "{\\"assetType\\":\\"$type\\",\\"value\\":1000000}" &
done
wait`,
          },
        ]}
      />

      <h2 id="goals">{p.sec.goals}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/clients/{clientId}/goals" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/clients/$CLIENT_ID/goals" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "goalType": "RETIREMENT", "targetAmount": 5000000000 }'`,
          },
        ]}
      />

      <h2 id="profile">{p.sec.profile}</h2>
      <p>
        <EndpointPill method="PUT" path="/api/integration/v1/clients/{clientId}/profile" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X PUT "${env.baseUrl}/api/integration/v1/clients/$CLIENT_ID/profile" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "age": 45,
    "dependents": 2,
    "incomeMonthly": 80000000,
    "riskTolerance": "MEDIUM"
  }'`,
          },
        ]}
      />

      <h2 id="errors">{p.sec.errors}</h2>
      <ErrorTable rows={p.errors} />

      <NextSteps
        steps={[
          {
            to: "/guides/discovery-check",
            title: p.nextCheck.title,
            description: p.nextCheck.desc,
          },
          {
            to: "/concepts/idempotency",
            title: p.nextIdempotency.title,
            description: p.nextIdempotency.desc,
          },
        ]}
      />
    </Layout>
  );
}
