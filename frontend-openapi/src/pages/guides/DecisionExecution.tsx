import { Layout } from "../../components/Layout";
import { PageHeader, MetaPill } from "../../components/PageHeader";
import { CodeTabs } from "../../components/CodeTabs";
import { Mermaid } from "../../components/Mermaid";
import { Callout } from "../../components/Callout";
import { ErrorTable } from "../../components/ErrorTable";
import { NextSteps } from "../../components/NextSteps";
import { EndpointPill } from "../../components/EndpointPill";
import { useEnv } from "../../env";
import { useT } from "../../i18n";

const FLOW = `sequenceDiagram
  participant P as Partner
  participant API as SmartWealth API
  participant Core as Core Banking (downstream)
  P->>API: POST /recommendations/:id/decision (APPROVED)
  API-->>P: 200
  P->>API: POST /execution/instructions
  API-->>P: 201 instructionId (status DRAFT)
  P->>API: POST /execution/send
  API->>Core: forward instruction
  API-->>P: 200 status SENT
  API-->>P: webhook execution.sent
`;

export function DecisionExecutionGuide() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.guideDecisionExec;

  const TOC = [
    { id: "diagram", label: p.sec.diagram, level: 2 as const },
    { id: "decision", label: p.sec.decision, level: 2 as const },
    { id: "instruction", label: p.sec.instruction, level: 2 as const },
    { id: "send", label: p.sec.send, level: 2 as const },
    { id: "errors", label: p.sec.errors, level: 2 as const },
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

      <h2 id="decision">{p.sec.decision}</h2>
      <p>
        <EndpointPill
          method="POST"
          path="/api/integration/v1/recommendations/{recommendationId}/decision"
        />
      </p>
      <CodeTabs
        samples={[
          {
            label: "Approve",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/recommendations/$REC_ID/decision" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "decisionStatus": "APPROVED" }'`,
          },
          {
            label: "Reject",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/recommendations/$REC_ID/decision" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "decisionStatus": "REJECTED" }'`,
          },
        ]}
      />

      <h2 id="instruction">{p.sec.instruction}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/execution/instructions" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/execution/instructions" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "recommendationId": "rec_01...",
    "note": "Created from partner",
    "payload": { "channel": "BROKER", "ticketId": "T-9001" }
  }'`,
          },
          {
            label: `${t.common.response} 201`,
            language: "json",
            code: `{
  "id": "ins_01...",
  "recommendationId": "rec_01...",
  "status": "DRAFT",
  "createdAt": "2026-05-10T08:55:00Z"
}`,
          },
        ]}
      />

      <h2 id="send">{p.sec.send}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/execution/send" />
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/execution/send" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "instructionId": "ins_01..." }'`,
          },
          {
            label: "Webhook",
            language: "json",
            code: `{
  "id": "evt_01...",
  "type": "execution.sent",
  "data": {
    "instructionId": "ins_01...",
    "recommendationId": "rec_01...",
    "status": "SENT"
  }
}`,
          },
        ]}
      />
      <Callout tone="warn" title={p.atLeastOnce.title}>
        {p.atLeastOnce.body}
      </Callout>

      <h2 id="errors">{p.sec.errors}</h2>
      <ErrorTable rows={p.errors} />

      <NextSteps
        steps={[
          {
            to: "/webhooks",
            title: p.nextWebhook.title,
            description: p.nextWebhook.desc,
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
