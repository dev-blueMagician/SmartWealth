import { useEffect, useRef, useState } from "react";

let mermaidModule: typeof import("mermaid") | null = null;

async function getMermaid() {
  if (!mermaidModule) {
    mermaidModule = await import("mermaid");
  }
  return mermaidModule.default;
}

export function Mermaid({ chart, caption }: { chart: string; caption?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = await getMermaid();
        mermaid.initialize({
          startOnLoad: false,
          theme: "base",
          themeVariables: {
            background: "#ffffff",
            primaryColor: "#EFF6FF",
            primaryTextColor: "#0f172a",
            primaryBorderColor: "#BFDBFE",
            secondaryColor: "#F1F5F9",
            secondaryTextColor: "#334155",
            tertiaryColor: "#FAFBFC",
            lineColor: "#94A3B8",
            fontFamily: "Inter, system-ui, sans-serif",
          },
          sequence: { useMaxWidth: true, mirrorActors: false, showSequenceNumbers: true },
          flowchart: { useMaxWidth: true, htmlLabels: true },
          gantt: { useMaxWidth: true },
        });
        if (cancelled || !ref.current) return;
        const id = "m" + Math.random().toString(36).slice(2, 9);
        const { svg } = await mermaid.render(id, chart);
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = svg;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (!cancelled) setError(msg);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  return (
    <figure className="my-5 doc-card">
      {error ? (
        <pre className="text-red-600 text-xs whitespace-pre-wrap">{error}</pre>
      ) : (
        <div ref={ref} className="overflow-x-auto" />
      )}
      {caption && (
        <figcaption className="text-xs text-slate-500 mt-2 text-center">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
