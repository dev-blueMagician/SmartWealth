import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { useT } from "../i18n";

export type NextStep = {
  to: string;
  title: string;
  description?: string;
};

export function NextSteps({ steps }: { steps: NextStep[] }) {
  const t = useT();
  return (
    <section className="my-10">
      <h3 className="text-slate-900 mb-3 font-semibold">{t.common.nextSteps}</h3>
      <div className="grid md:grid-cols-2 gap-3">
        {steps.map((s) => (
          <Link
            key={s.to}
            to={s.to}
            className="doc-card hover:border-accent/40 hover:shadow-md transition group block"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-slate-900 font-medium">{s.title}</div>
                {s.description && (
                  <div className="text-sm text-slate-600 mt-1">{s.description}</div>
                )}
              </div>
              <ArrowRight
                size={16}
                className="text-slate-400 group-hover:text-accent transition shrink-0 mt-1"
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
