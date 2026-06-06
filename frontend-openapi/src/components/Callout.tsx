import { AlertTriangle, Info, CheckCircle2, AlertOctagon, type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";

type Tone = "info" | "warn" | "ok" | "danger";

const TONE_MAP: Record<Tone, { icon: LucideIcon; cls: string }> = {
  info: { icon: Info, cls: "bg-blue-50 border-blue-200 text-blue-900" },
  warn: { icon: AlertTriangle, cls: "bg-amber-50 border-amber-200 text-amber-950" },
  ok: { icon: CheckCircle2, cls: "bg-emerald-50 border-emerald-200 text-emerald-950" },
  danger: { icon: AlertOctagon, cls: "bg-red-50 border-red-200 text-red-950" },
};

export function Callout({
  tone = "info",
  title,
  children,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
}) {
  const { icon: Icon, cls } = TONE_MAP[tone];
  return (
    <aside className={`my-4 p-4 rounded-xl border flex gap-3 ${cls}`}>
      <Icon size={18} className="mt-0.5 shrink-0 opacity-90" />
      <div className="text-sm leading-relaxed">
        {title && <div className="font-semibold mb-1">{title}</div>}
        <div className="text-slate-700">{children}</div>
      </div>
    </aside>
  );
}
