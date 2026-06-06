type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export function EndpointPill({ method, path }: { method: Method; path: string }) {
  const cls =
    method === "GET"
      ? "method-get"
      : method === "POST"
        ? "method-post"
        : method === "PUT" || method === "PATCH"
          ? "method-put"
          : "method-delete";
  return (
    <code className="inline-flex items-center bg-bg-subtle border border-border rounded px-2 py-0.5 text-xs">
      <span className={`method-badge ${cls}`}>{method}</span>
      <span className="text-slate-800">{path}</span>
    </code>
  );
}
