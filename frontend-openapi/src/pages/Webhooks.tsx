import { Layout } from "../components/Layout";
import { PageHeader, MetaPill } from "../components/PageHeader";
import { CodeTabs } from "../components/CodeTabs";
import { Callout } from "../components/Callout";
import { Mermaid } from "../components/Mermaid";
import { ErrorTable } from "../components/ErrorTable";
import { useT } from "../i18n";

const RETRY_DIAGRAM = `gantt
  title Retry timeline (best-effort)
  dateFormat HH:mm
  axisFormat %H:%M
  section Attempts
  Attempt 1 :a1, 00:00, 1m
  Attempt 2 :a2, after a1, 5m
  Attempt 3 :a3, after a2, 30m
  Attempt 4 :a4, after a3, 120m
  Attempt 5 :a5, after a4, 720m
`;

export function WebhooksPage() {
  const t = useT();
  const p = t.pages.webhooks;

  const TOC = [
    { id: "events", label: p.sec.events, level: 2 as const },
    { id: "delivery", label: p.sec.delivery, level: 2 as const },
    { id: "signature", label: p.sec.signature, level: 2 as const },
    { id: "retry", label: p.sec.retry, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={
          <>
            <MetaPill tone="accent">{t.common.atLeastOnce}</MetaPill>
            <MetaPill>{t.common.hmacSha256}</MetaPill>
          </>
        }
      />

      <h2 id="events">{p.sec.events}</h2>
      <table>
        <thead>
          <tr>
            <th>{p.eventsTable.headerType}</th>
            <th>{p.eventsTable.headerWhen}</th>
            <th>{p.eventsTable.headerPayload}</th>
          </tr>
        </thead>
        <tbody>
          {p.eventsTable.rows.map((row) => (
            <tr key={row.type}>
              <td>
                <code>{row.type}</code>
              </td>
              <td>{row.when}</td>
              <td>
                <code>{row.payload}</code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 id="delivery">{p.sec.delivery}</h2>
      <CodeTabs
        samples={[
          {
            label: t.common.headers,
            language: "http",
            code: `POST /your-endpoint HTTP/1.1
Content-Type: application/json
X-SmartWealth-Event: case.discovery.ready
X-SmartWealth-Delivery: dlv_01HZ...
X-SmartWealth-Signature: t=1715332334,v1=5d41402abc4b...`,
          },
          {
            label: t.common.body,
            language: "json",
            code: `{
  "id": "evt_01HZABCDEF",
  "type": "case.discovery.ready",
  "createdAt": "2026-05-10T08:32:14Z",
  "data": {
    "caseId": "0a1b2c3d-...",
    "clientId": "9f8e7d6c-...",
    "status": "READY",
    "missingFields": []
  }
}`,
          },
        ]}
      />

      <h2 id="signature">{p.sec.signature}</h2>
      <CodeTabs
        samples={[
          {
            label: "TypeScript",
            language: "tsx",
            code: `import crypto from "node:crypto";

function verify(body: string, header: string, secret: string) {
  const [tPart, vPart] = header.split(",");
  const t = tPart.split("=")[1];
  const v1 = vPart.split("=")[1];
  const signed = crypto
    .createHmac("sha256", secret)
    .update(\`\${t}.\${body}\`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(signed), Buffer.from(v1));
}`,
          },
          {
            label: "Python",
            language: "python",
            code: `import hmac, hashlib

def verify(body: bytes, header: str, secret: str) -> bool:
    t = header.split(",")[0].split("=")[1]
    v1 = header.split(",")[1].split("=")[1]
    signed = hmac.new(secret.encode(), f"{t}.".encode() + body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(signed, v1)`,
          },
        ]}
      />
      <Callout tone="warn" title={p.rejectReplayTitle}>
        {p.rejectReplayBody}
      </Callout>

      <h2 id="retry">{p.sec.retry}</h2>
      <Mermaid chart={RETRY_DIAGRAM} caption={p.retryCaption} />
      <ErrorTable rows={p.retryRows} />
    </Layout>
  );
}
