import { useState } from "react";
import { CodeBlock } from "./CodeBlock";

export type CodeSample = {
  label: string;
  language: string;
  code: string;
  filename?: string;
};

export function CodeTabs({ samples }: { samples: CodeSample[] }) {
  const [active, setActive] = useState(0);
  if (samples.length === 0) return null;
  const current = samples[active];

  return (
    <div className="my-4">
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {samples.map((sample, idx) => (
          <button
            key={sample.label}
            onClick={() => setActive(idx)}
            className={
              "text-xs px-2.5 py-1 rounded-md font-medium transition border " +
              (idx === active
                ? "bg-white text-slate-900 ring-1 ring-accent/30 border-border shadow-sm"
                : "text-slate-600 hover:text-slate-900 hover:bg-bg-subtle border-transparent")
            }
          >
            {sample.label}
          </button>
        ))}
      </div>
      <CodeBlock code={current.code} language={current.language} filename={current.filename} />
    </div>
  );
}
