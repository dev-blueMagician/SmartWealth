import { type ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, meta }: PageHeaderProps) {
  return (
    <header className="mb-8">
      {eyebrow && (
        <div className="text-[11px] uppercase tracking-wider text-accent font-semibold mb-2">
          {eyebrow}
        </div>
      )}
      <h1>{title}</h1>
      {description && <p className="mt-3 text-slate-600 text-base">{description}</p>}
      {meta && <div className="mt-4 flex flex-wrap items-center gap-2">{meta}</div>}
    </header>
  );
}

export function MetaPill({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "accent" | "warn" | "ok";
}) {
  const cls =
    tone === "accent"
      ? "bg-blue-50 text-blue-800 border-blue-200"
      : tone === "warn"
        ? "bg-amber-50 text-amber-950 border-amber-200"
        : tone === "ok"
          ? "bg-emerald-50 text-emerald-900 border-emerald-200"
          : "bg-bg-subtle text-slate-700 border-border";
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${cls}`}>{children}</span>
  );
}
