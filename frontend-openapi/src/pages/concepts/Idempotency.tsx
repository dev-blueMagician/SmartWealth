import { Layout } from "../../components/Layout";
import { PageHeader } from "../../components/PageHeader";
import { Callout } from "../../components/Callout";
import { CodeTabs } from "../../components/CodeTabs";
import { useT } from "../../i18n";

export function IdempotencyConcept() {
  const t = useT();
  const p = t.pages.conceptIdempotency;

  const TOC = [
    { id: "key", label: p.sec.key, level: 2 as const },
    { id: "retry", label: p.sec.retry, level: 2 as const },
    { id: "webhook", label: p.sec.webhook, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader eyebrow={p.eyebrow} title={p.title} description={p.description} />

      <h2 id="key">{p.sec.key}</h2>
      <p>{p.keyBody}</p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "$BASE/api/integration/v1/cases" \\
  -H "Authorization: Bearer $KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{ "clientName": "Nguyen Van A" }'`,
          },
        ]}
      />

      <h2 id="retry">{p.sec.retry}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.retryItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 id="webhook">{p.sec.webhook}</h2>
      <p>{p.webhookBody}</p>

      <Callout tone="warn" title={p.note.title}>
        {p.note.body}
      </Callout>
    </Layout>
  );
}
