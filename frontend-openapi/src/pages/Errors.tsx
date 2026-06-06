import { Layout } from "../components/Layout";
import { PageHeader } from "../components/PageHeader";
import { CodeTabs } from "../components/CodeTabs";
import { ErrorTable } from "../components/ErrorTable";
import { useT } from "../i18n";

export function ErrorsPage() {
  const t = useT();
  const p = t.pages.errorsPage;

  const TOC = [
    { id: "shape", label: p.sec.shape, level: 2 as const },
    { id: "common", label: p.sec.common, level: 2 as const },
    { id: "rate", label: p.sec.rate, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader eyebrow={p.eyebrow} title={p.title} description={p.description} />

      <h2 id="shape">{p.sec.shape}</h2>
      <CodeTabs
        samples={[
          {
            label: `${t.common.response} 4xx`,
            language: "json",
            code: `{
  "code": "VALIDATION_FAILED",
  "message": "Field 'value' must be >= 0",
  "details": { "field": "value", "received": -100 }
}`,
          },
          {
            label: `${t.common.response} 5xx`,
            language: "json",
            code: `{
  "code": "AI_TIMEOUT",
  "message": "AI-engine took longer than 30s",
  "details": { "assessmentCode": "onboarding_completeness" }
}`,
          },
        ]}
      />

      <h2 id="common">{p.sec.common}</h2>
      <ErrorTable rows={p.rows} />

      <h2 id="rate">{p.sec.rate}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.rateItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Layout>
  );
}
