import { Layout } from "../../components/Layout";
import { PageHeader, MetaPill } from "../../components/PageHeader";
import { CodeTabs } from "../../components/CodeTabs";
import { Mermaid } from "../../components/Mermaid";
import { ErrorTable } from "../../components/ErrorTable";
import { NextSteps } from "../../components/NextSteps";
import { EndpointPill } from "../../components/EndpointPill";
import { Callout } from "../../components/Callout";
import { useEnv } from "../../env";
import { useT } from "../../i18n";

const FLOW = `sequenceDiagram
  participant P as Partner
  participant API as SmartWealth API
  participant AI as AI-engine
  P->>API: GET /cases/{caseId}/chat/thread
  API-->>P: 200 threadId, channel
  P->>API: POST /cases/{caseId}/chat/messages
  API->>AI: Forward + context (phase, assessment)
  AI-->>API: AI response + intent
  API-->>P: 201 { userMessage, aiReply }
  P->>API: GET /cases/{caseId}/chat/messages?threadId=...
  API-->>P: 200 message[]
`;

const ATTACH_FLOW = `sequenceDiagram
  participant P as Partner
  participant API as SmartWealth API
  P->>API: POST /cases/{caseId}/chat/attachments (multipart)
  API-->>P: 201 { caseDocumentId, storedDocumentId }
  P->>API: POST /cases/{caseId}/chat/messages (attachmentIds)
  API-->>P: 201 AI processes attachment context
`;

export function ChatChannelGuide() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.guideChatChannel;

  const TOC = [
    { id: "when", label: p.sec.when, level: 2 as const },
    { id: "diagram", label: p.sec.diagram, level: 2 as const },
    { id: "prereq", label: p.sec.prereq, level: 2 as const },
    { id: "thread", label: p.sec.thread, level: 2 as const },
    { id: "send", label: p.sec.send, level: 2 as const },
    { id: "detect-intent", label: p.sec.detectIntent, level: 2 as const },
    { id: "attachments", label: p.sec.attachments, level: 2 as const },
    { id: "visibility", label: p.sec.visibility, level: 2 as const },
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
            <MetaPill tone="ok">{t.common.minutes(10)}</MetaPill>
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

      <h2 id="thread">{p.sec.thread}</h2>
      <p>
        <EndpointPill method="GET" path="/api/integration/v1/cases/{caseId}/chat/thread" />
      </p>
      <p className="mt-2 text-slate-600">{p.threadBody}</p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS "${env.baseUrl}/api/integration/v1/cases/$CASE_ID/chat/thread" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx"`,
          },
          {
            label: "TypeScript",
            language: "tsx",
            code: `const res = await fetch(\`\${BASE}/api/integration/v1/cases/\${caseId}/chat/thread\`, {
  headers: { Authorization: \`Bearer \${apiKey}\` },
});
const { id: threadId, channel, createdAt } = await res.json();`,
          },
          {
            label: `${t.common.response} 200`,
            language: "json",
            code: `{
  "id": "aabb1122-...",
  "caseId": "0a1b2c3d-...",
  "channel": "CASE_CHAT",
  "createdAt": "2026-05-10T09:00:00Z",
  "updatedAt": "2026-05-10T09:00:00Z"
}`,
          },
        ]}
      />

      <h2 id="send">{p.sec.send}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/cases/{caseId}/chat/messages" />
      </p>
      <p className="mt-2 text-slate-600">{p.sendBody}</p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/cases/$CASE_ID/chat/messages" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "threadId": "aabb1122-...",
    "message": "Please review my retirement plan",
    "visibility": "ALL",
    "autoDetectIntent": true
  }'`,
          },
          {
            label: "TypeScript",
            language: "tsx",
            code: `const res = await fetch(\`\${BASE}/api/integration/v1/cases/\${caseId}/chat/messages\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${apiKey}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    threadId,
    message: "Please review my retirement plan",
    visibility: "ALL",
    autoDetectIntent: true,
  }),
});
const { userMessage, aiReply } = await res.json();`,
          },
          {
            label: `${t.common.response} 201`,
            language: "json",
            code: `{
  "userMessage": {
    "id": "msg-001-...",
    "senderKind": "USER",
    "body": "Please review my retirement plan",
    "phaseCode": "PLANNING",
    "createdAt": "2026-05-10T09:01:00Z"
  },
  "aiReply": {
    "id": "msg-002-...",
    "senderKind": "ASSISTANT",
    "body": "I've reviewed your retirement plan. Based on your goals...",
    "intentCode": "plan_review",
    "assessmentCode": "plan_recommendation",
    "aiPayload": { "confidence": 0.92, "suggestedActions": [...] },
    "createdAt": "2026-05-10T09:01:02Z"
  }
}`,
          },
        ]}
      />

      <Callout tone="info" title={p.autoDetectNote.title}>
        {p.autoDetectNote.body}
      </Callout>

      <h2 id="detect-intent">{p.sec.detectIntent}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/cases/{caseId}/chat/detect-intent" />
      </p>
      <p className="mt-2 text-slate-600">{p.detectIntentBody}</p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "${env.baseUrl}/api/integration/v1/cases/$CASE_ID/chat/detect-intent" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{ "threadId": "aabb1122-...", "message": "I want to add a new asset" }'`,
          },
          {
            label: `${t.common.response} 200`,
            language: "json",
            code: `{
  "intentCode": "add_asset",
  "phaseCode": "DISCOVERY",
  "assessmentCode": "onboarding_completeness",
  "confidence": 0.95
}`,
          },
        ]}
      />

      <h2 id="attachments">{p.sec.attachments}</h2>
      <p>
        <EndpointPill method="POST" path="/api/integration/v1/cases/{caseId}/chat/attachments" />
      </p>
      <p className="mt-2 text-slate-600">{p.attachBody}</p>
      <Mermaid chart={ATTACH_FLOW} />
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `# Step 1: Upload attachment
curl -sS -X POST "${env.baseUrl}/api/integration/v1/cases/$CASE_ID/chat/attachments" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -F "file=@/path/to/document.pdf" \\
  -F "docKind=ID_CARD"

# Step 2: Send message with attachment reference
curl -sS -X POST "${env.baseUrl}/api/integration/v1/cases/$CASE_ID/chat/messages" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "threadId": "aabb1122-...",
    "message": "Here is my ID document",
    "attachmentIds": ["doc-uuid-..."]
  }'`,
          },
          {
            label: `${t.common.response} 201`,
            language: "json",
            code: `{
  "caseDocumentId": "doc-uuid-...",
  "storedDocumentId": "stored-uuid-...",
  "filename": "document.pdf",
  "docKind": "ID_CARD",
  "uploadedAt": "2026-05-10T09:05:00Z"
}`,
          },
        ]}
      />

      <h2 id="visibility">{p.sec.visibility}</h2>
      <p className="text-slate-600">{p.visibilityBody}</p>
      <ul className="list-disc pl-6 space-y-1 text-slate-600 mt-2">
        {p.visibilityItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

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
            to: "/webhooks",
            title: p.nextWebhook.title,
            description: p.nextWebhook.desc,
          },
        ]}
      />
    </Layout>
  );
}
