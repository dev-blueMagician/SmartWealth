import { NavLink } from "react-router-dom";
import { buildNav } from "../nav";
import { useT } from "../i18n";

export function Sidebar() {
  const t = useT();
  const nav = buildNav(t);
  return (
    <nav className="space-y-6 text-sm">
      {nav.map((group) => (
        <div key={group.title}>
          <div className="px-3 mb-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold">
            {group.title}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  className={({ isActive }) =>
                    "doc-link" + (isActive ? " active" : "")
                  }
                >
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge && (
                    <span className={`badge badge-${item.badge}`}>{item.badge}</span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <div className="px-3 pt-4 border-t border-border text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          {t.common.systemsOk}
        </div>
      </div>
    </nav>
  );
}
