import { Layout } from "../components/Layout";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../i18n";

export function ChangelogPage() {
  const t = useT();
  const p = t.pages.changelog;

  const TOC = [
    { id: "v0-2-0", label: p.versionTitle, level: 2 as const },
    { id: "v0-1-0", label: p.version010Title, level: 2 as const },
    { id: "policy", label: p.policyTitle, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader eyebrow={p.eyebrow} title={p.title} description={p.description} />

      <h2 id="v0-2-0">{p.versionTitle}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.versionItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 id="v0-1-0">{p.version010Title}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.version010Items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 id="policy">{p.policyTitle}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.policyItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Layout>
  );
}
