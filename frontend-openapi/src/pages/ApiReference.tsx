import { useEffect, useState } from "react";
import { Layout } from "../components/Layout";
import { PageHeader, MetaPill } from "../components/PageHeader";
import { Callout } from "../components/Callout";
import { useT } from "../i18n";
import "@stoplight/elements/styles.min.css";

export function ApiReferencePage() {
  const t = useT();
  const p = t.pages.apiReference;
  const [ApiComp, setApiComp] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@stoplight/elements")
      .then((mod) => {
        if (cancelled) return;
        setApiComp(() => mod.API as unknown as React.ComponentType<Record<string, unknown>>);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled) setError(msg);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Layout hideRightRail>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={
          <>
            <MetaPill tone="accent">{t.common.openapi31}</MetaPill>
            <MetaPill>Stoplight Elements</MetaPill>
          </>
        }
      />

      <Callout tone="info" title={p.note.title}>
        {p.note.body}
      </Callout>

      <div className="mt-6 -mx-2 rounded-xl overflow-hidden border border-border bg-bg-panel shadow-card">
        {error && (
          <div className="p-6 text-red-600 text-sm">
            {p.failed}: {error}
          </div>
        )}
        {!ApiComp && !error && (
          <div className="p-6 text-slate-500 text-sm">{p.loading}</div>
        )}
        {ApiComp && (
          <ApiComp
            apiDescriptionUrl="/openapi/integration.yaml"
            router="hash"
            layout="sidebar"
            hideTryIt={false}
          />
        )}
      </div>
    </Layout>
  );
}
