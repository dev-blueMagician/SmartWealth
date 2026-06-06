import { Check, Copy } from "lucide-react";
import { Highlight, themes } from "prism-react-renderer";
import { useState } from "react";
import { useT } from "../i18n";

type CodeBlockProps = {
  code: string;
  language?: string;
  filename?: string;
};

export function CodeBlock({ code, language = "bash", filename }: CodeBlockProps) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-bg-panel shadow-card">
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-muted border-b border-border text-[11px]">
        <span className="font-mono text-slate-500">{filename ?? language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-slate-500 hover:text-slate-900 hover:bg-bg-panel border border-transparent hover:border-border transition"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          <span>{copied ? t.common.copied : t.common.copy}</span>
        </button>
      </div>
      <Highlight code={code.trim()} language={language as never} theme={themes.github}>
        {({ className, style, tokens, getLineProps, getTokenProps }) => (
          <pre
            className={className + " p-4 text-sm overflow-x-auto leading-relaxed"}
            style={{ ...style, background: "transparent" }}
          >
            {tokens.map((line, i) => {
              const lineProps = getLineProps({ line });
              return (
                <div key={i} {...lineProps}>
                  <span className="select-none inline-block w-8 text-right pr-3 text-slate-400">
                    {i + 1}
                  </span>
                  {line.map((token, key) => {
                    const tokenProps = getTokenProps({ token });
                    return <span key={key} {...tokenProps} />;
                  })}
                </div>
              );
            })}
          </pre>
        )}
      </Highlight>
    </div>
  );
}
