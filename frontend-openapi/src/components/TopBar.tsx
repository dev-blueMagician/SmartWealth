import { Link } from "react-router-dom";
import { Search, Github, MessageCircle } from "lucide-react";
import { EnvSwitcher } from "./EnvSwitcher";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useT } from "../i18n";

export function TopBar() {
  const t = useT();
  return (
    <header className="sticky top-0 z-30 h-14 border-b border-border bg-bg-panel/85 backdrop-blur-md shadow-[0_1px_0_rgba(15,23,42,0.02)]">
      <div className="h-full max-w-[1320px] mx-auto px-4 lg:px-6 flex items-center gap-3">
        <Link to="/" className="flex items-center gap-2 group">
          <div className="w-7 h-7 rounded-md bg-accent flex items-center justify-center text-white font-bold shadow-sm">
            S
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold text-slate-900">SmartWealth</div>
            <div className="text-[10px] uppercase tracking-wider text-slate-500">
              Developer · AI Engine
            </div>
          </div>
        </Link>

        <div className="flex-1 flex justify-center">
          <button
            type="button"
            className="hidden md:flex items-center gap-2 px-3 h-9 w-[420px] max-w-full rounded-lg border border-border bg-bg-muted hover:bg-white hover:border-accent/30 text-sm text-slate-500 transition shadow-sm"
            onClick={() => alert(t.common.searchAlert)}
          >
            <Search size={16} className="text-slate-400" />
            <span className="truncate">{t.common.search}</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-bg-panel border border-border text-slate-500 shadow-sm">
              ⌘K
            </kbd>
          </button>
        </div>

        <LanguageSwitcher />
        <EnvSwitcher />
        <a
          href="#"
          className="hidden md:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          aria-label="Github"
        >
          <Github size={16} />
        </a>
        <a
          href="#"
          className="hidden md:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800"
          aria-label="Support"
        >
          <MessageCircle size={16} />
        </a>
      </div>
    </header>
  );
}
