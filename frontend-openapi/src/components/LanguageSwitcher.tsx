import { Check, ChevronDown, Languages } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, type Lang } from "../i18n";

const LANGS: { key: Lang; label: string; native: string }[] = [
  { key: "en", label: "English", native: "EN" },
  { key: "vi", label: "Tiếng Việt", native: "VI" },
];

export function LanguageSwitcher() {
  const { lang, setLang } = useLocale();
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

  const current = LANGS.find((l) => l.key === lang) ?? LANGS[0];

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 h-9 px-2.5 rounded-lg border border-border bg-bg-panel hover:bg-bg-muted text-sm text-slate-700 transition shadow-sm"
        aria-label="Change language"
      >
        <Languages size={14} className="text-slate-500" />
        <span className="font-medium text-xs tracking-wide">{current.native}</span>
        <ChevronDown size={14} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg border border-border bg-bg-panel shadow-lg z-40 overflow-hidden">
          {LANGS.map((l) => {
            const selected = lang === l.key;
            return (
              <button
                key={l.key}
                onClick={() => {
                  setLang(l.key);
                  setOpen(false);
                }}
                className="w-full text-left px-3 py-2 hover:bg-bg-muted flex items-center gap-2 text-sm"
              >
                <Check
                  size={14}
                  className={selected ? "text-accent" : "text-transparent"}
                />
                <span className="font-medium text-slate-800">{l.label}</span>
                <span className="ml-auto text-[10px] text-slate-400 font-mono">
                  {l.native}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
