import { Layout } from "../../components/Layout";
import { PageHeader } from "../../components/PageHeader";
import { Callout } from "../../components/Callout";
import { useT } from "../../i18n";

export function CatalogSsotConcept() {
  const t = useT();
  const p = t.pages.conceptCatalogSsot;

  const TOC = [
    { id: "what", label: p.sec.what, level: 2 as const },
    { id: "tables", label: p.sec.tables, level: 2 as const },
    { id: "version", label: p.sec.version, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader eyebrow={p.eyebrow} title={p.title} description={p.description} />

      <h2 id="what">{p.sec.what}</h2>
      <p>{p.whatBody}</p>

      <h2 id="tables">{p.sec.tables}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.tables.map((row) => (
          <li key={row}>{row}</li>
        ))}
      </ul>

      <h2 id="version">{p.sec.version}</h2>
      <p>{p.versionBody}</p>

      <Callout tone="info" title={p.note.title}>
        {p.note.body}
      </Callout>
    </Layout>
  );
}
