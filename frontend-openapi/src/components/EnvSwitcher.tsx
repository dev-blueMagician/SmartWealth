import { Check, ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ENVIRONMENTS, useEnv, type EnvKey } from "../env";
import { useT } from "../i18n";

export function EnvSwitcher() {
  const { env, setEnv } = useEnv();
  const t = useT();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          "flex items-center gap-2 h-9 px-3 rounded-lg border text-sm transition shadow-sm " +
          (env.key === "production"
            ? "border-amber-300 bg-amber-50 text-amber-950"
            : "border-emerald-300 bg-emerald-50 text-emerald-950")
        }
      >
        <span
          className={
            "w-2 h-2 rounded-full " +
            (env.key === "production" ? "bg-amber-500" : "bg-emerald-500")
          }
        />
        <span className="font-medium">{env.label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-lg border border-border bg-bg-panel shadow-lg z-40 overflow-hidden">
          {(Object.keys(ENVIRONMENTS) as EnvKey[]).map((key) => {
            const e = ENVIRONMENTS[key];
            const selected = env.key === key;
            return (
              <button
                key={key}
                onClick={() => {
                  setEnv(key);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2.5 hover:bg-bg-subtle flex items-start gap-2"
              >
                <Check
                  size={14}
                  className={"mt-1 " + (selected ? "text-accent" : "text-transparent")}
                />
                <div className="text-xs">
                  <div className="text-slate-900 font-medium">{e.label}</div>
                  <div className="text-slate-500 font-mono">{e.baseUrl}</div>
                  <div className="text-slate-400">{t.common.tokenPrefix}: {e.tokenPrefix}…</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
