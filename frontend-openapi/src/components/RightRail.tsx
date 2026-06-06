import { useEffect, useState } from "react";
import { useT } from "../i18n";

export type TocItem = {
  id: string;
  label: string;
  level?: 2 | 3;
};

export function RightRail({ toc }: { toc?: TocItem[] }) {
  const t = useT();
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!toc || toc.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: [0, 1] },
    );
    toc.forEach((item) => {
      const el = document.getElementById(item.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [toc]);

  return (
    <div className="space-y-6 text-sm">
      {toc && toc.length > 0 && (
        <div>
          <div className="text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-2">
            {t.common.onThisPage}
          </div>
          <ul className="space-y-1">
            {toc.map((item) => (
              <li key={item.id}>
                <a
                  href={`#${item.id}`}
                  className={
                    "block py-1 pr-2 border-l-2 pl-3 transition " +
                    (item.level === 3 ? "ml-3 text-[13px] " : "") +
                    (activeId === item.id
                      ? "border-accent text-accent-hover font-medium"
                      : "border-transparent text-slate-500 hover:text-slate-800")
                  }
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="doc-card text-xs space-y-2 bg-gradient-to-br from-accent-soft to-bg-panel border-accent/20">
        <div className="text-slate-900 font-medium">{t.common.needHelp}</div>
        <p className="text-slate-600 leading-relaxed">
          {t.common.contactBlurb}{" "}
          <a href="mailto:developers@smartwealth.example">
            developers@smartwealth.example
          </a>
          .
        </p>
      </div>

      <div className="text-[11px] text-slate-400">
        {t.common.lastUpdated}: 2026-05-10
      </div>
    </div>
  );
}
