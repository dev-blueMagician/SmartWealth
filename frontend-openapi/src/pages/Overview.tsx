import { Link } from "react-router-dom";
import { Layout } from "../components/Layout";
import { PageHeader, MetaPill } from "../components/PageHeader";
import { Mermaid } from "../components/Mermaid";
import { ArrowRight, BookOpen, Zap, Code2, Webhook } from "lucide-react";
import { useT } from "../i18n";

const ARCHITECTURE = `flowchart LR
  Partner["Partner / 3rd-party<br/>(API key)"] --> Edge["SmartWealth API<br/>/api/integration/v1"]
  Edge --> Backend["Backend (Spring)"]
  Backend --> AI["AI-engine (FastAPI)"]
  Backend --> DB[("Postgres SSOT")]
  AI --> DB
  Backend -.callback.-> Partner
`;

export function OverviewPage() {
  const t = useT();
  const p = t.pages.overview;
  const TOC = [
    { id: "what", label: p.sec.what, level: 2 as const },
    { id: "architecture", label: p.sec.architecture, level: 2 as const },
    { id: "next", label: p.sec.next, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={
          <>
            <MetaPill tone="accent">v0.1.0</MetaPill>
            <MetaPill tone="ok">{p.sandboxOpen}</MetaPill>
            <MetaPill>{t.common.openapi31}</MetaPill>
          </>
        }
      />

      <div className="grid md:grid-cols-3 gap-4 my-6">
        <Link to="/quickstart" className="doc-card hover:border-accent/50 transition group">
          <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
            <Zap className="text-accent" size={18} />
          </div>
          <div className="font-semibold text-slate-900">{p.cards.quickstart.title}</div>
          <p className="text-sm text-slate-600 mt-1">{p.cards.quickstart.desc}</p>
          <div className="mt-3 text-xs text-accent flex items-center gap-1 font-medium">
            {p.cards.quickstart.cta}{" "}
            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition" />
          </div>
        </Link>

        <Link
          to="/guides/onboarding-case"
          className="doc-card hover:border-accent/50 transition group"
        >
          <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center mb-3">
            <BookOpen className="text-emerald-600" size={18} />
          </div>
          <div className="font-semibold text-slate-900">{p.cards.guides.title}</div>
          <p className="text-sm text-slate-600 mt-1">{p.cards.guides.desc}</p>
          <div className="mt-3 text-xs text-accent flex items-center gap-1 font-medium">
            {p.cards.guides.cta}{" "}
            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition" />
          </div>
        </Link>

        <Link to="/api-reference" className="doc-card hover:border-accent/50 transition group">
          <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center mb-3">
            <Code2 className="text-amber-600" size={18} />
          </div>
          <div className="font-semibold text-slate-900">{p.cards.apiRef.title}</div>
          <p className="text-sm text-slate-600 mt-1">{p.cards.apiRef.desc}</p>
          <div className="mt-3 text-xs text-accent flex items-center gap-1 font-medium">
            {p.cards.apiRef.cta}{" "}
            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition" />
          </div>
        </Link>
      </div>

      <h2 id="what">{p.sec.what}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.whatItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <h2 id="architecture">{p.sec.architecture}</h2>
      <p>
        {p.archDescPrefix}
        <strong>{p.archDescBold}</strong>
        {p.archDescBetween}
        <code>{p.archDescCode}</code>
        {p.archDescAfter}
        <Link to="/webhooks">{p.archDescLink}</Link>.
      </p>
      <Mermaid chart={ARCHITECTURE} caption={p.archCaption} />

      <h2 id="next">{p.sec.next}</h2>
      <div className="grid md:grid-cols-2 gap-3">
        <Link to="/authentication" className="doc-card hover:border-accent/50">
          <div className="font-semibold text-slate-900">{p.nextCards.auth.title}</div>
          <p className="text-sm text-slate-600 mt-1">{p.nextCards.auth.desc}</p>
        </Link>
        <Link to="/webhooks" className="doc-card hover:border-accent/50">
          <Webhook size={16} className="text-violet-600 inline mr-1" />
          <span className="font-semibold text-slate-900">{p.nextCards.webhooks.title}</span>
          <p className="text-sm text-slate-600 mt-1">{p.nextCards.webhooks.desc}</p>
        </Link>
      </div>
    </Layout>
  );
}
