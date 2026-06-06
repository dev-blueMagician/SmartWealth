import { useT } from "../i18n";

export type ErrorRow = {
  code: string;
  http: number;
  reason: string;
  fix: string;
};

export function ErrorTable({ rows }: { rows: ErrorRow[] }) {
  const t = useT();
  return (
    <div className="my-4 overflow-x-auto">
      <table>
        <thead>
          <tr>
            <th className="w-44">{t.errors.headerCode}</th>
            <th className="w-16">{t.errors.headerHttp}</th>
            <th>{t.errors.headerReason}</th>
            <th>{t.errors.headerFix}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.code}>
              <td>
                <code>{r.code}</code>
              </td>
              <td>{r.http}</td>
              <td>{r.reason}</td>
              <td className="text-slate-600">{r.fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
