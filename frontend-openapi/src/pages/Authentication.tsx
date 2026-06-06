import { Layout } from "../components/Layout";
import { PageHeader, MetaPill } from "../components/PageHeader";
import { CodeTabs } from "../components/CodeTabs";
import { Callout } from "../components/Callout";
import { useEnv } from "../env";
import { useT } from "../i18n";

export function AuthenticationPage() {
  const { env } = useEnv();
  const t = useT();
  const p = t.pages.authentication;

  const TOC = [
    { id: "model", label: p.sec.model, level: 2 as const },
    { id: "api-key", label: p.sec.apiKey, level: 2 as const },
    { id: "oauth", label: p.sec.oauth, level: 2 as const },
    { id: "rotation", label: p.sec.rotation, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader
        eyebrow={p.eyebrow}
        title={p.title}
        description={p.description}
        meta={
          <>
            <MetaPill tone="accent">{env.label}</MetaPill>
            <MetaPill>{env.baseUrl}</MetaPill>
          </>
        }
      />

      <h2 id="model">{p.sec.model}</h2>
      <p>
        {p.modelBody}
        <strong>{p.modelBoldClient}</strong>
        {p.modelPlus}
        <strong>{p.modelBoldSecret}</strong>
        {p.modelOr}
        <strong>{p.modelBoldKey}</strong>
        {p.modelEnd}
      </p>

      <h2 id="api-key">{p.sec.apiKey}</h2>
      <p>
        {p.apiKeyBody1}
        <code>{p.apiKeyHeaderCode}</code>
        {p.apiKeyBody2}
        <code>{p.apiKeyPrefixSandbox}</code>
        {p.apiKeyAnd}
        <code>{p.apiKeyPrefixLive}</code>
        {p.apiKeyEnd}
      </p>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X GET "${env.baseUrl}/api/integration/v1/cases" \\
  -H "Authorization: Bearer ${env.tokenPrefix}xxxxxxxx"`,
          },
          {
            label: "TypeScript",
            language: "tsx",
            code: `await fetch("${env.baseUrl}/api/integration/v1/cases", {
  headers: {
    Authorization: \`Bearer \${process.env.SMARTWEALTH_API_KEY}\`,
  },
});`,
          },
          {
            label: "Java",
            language: "java",
            code: `var req = HttpRequest.newBuilder()
    .uri(URI.create("${env.baseUrl}/api/integration/v1/cases"))
    .header("Authorization", "Bearer " + System.getenv("SMARTWEALTH_API_KEY"))
    .GET()
    .build();`,
          },
          {
            label: "Python",
            language: "python",
            code: `import os, requests
r = requests.get(
    "${env.baseUrl}/api/integration/v1/cases",
    headers={"Authorization": f"Bearer {os.environ['SMARTWEALTH_API_KEY']}"},
)`,
          },
        ]}
      />

      <Callout tone="warn" title={p.dontUseJwt.title}>
        {p.dontUseJwt.body}
      </Callout>

      <h2 id="oauth">{p.sec.oauth}</h2>
      <CodeTabs
        samples={[
          {
            label: "curl",
            language: "bash",
            code: `curl -sS -X POST "https://auth.smartwealth.example/oauth/token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=$CLIENT_ID" \\
  -d "client_secret=$CLIENT_SECRET" \\
  -d "scope=integration"`,
          },
          {
            label: t.common.response,
            language: "json",
            code: `{
  "access_token": "eyJhbGciOi...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "integration"
}`,
          },
        ]}
      />
      <p>{p.oauthIntro}</p>

      <h2 id="rotation">{p.sec.rotation}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        {p.rotationItems.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </Layout>
  );
}
