import { Layout } from "../../components/Layout";
import { PageHeader } from "../../components/PageHeader";
import { Mermaid } from "../../components/Mermaid";
import { Callout } from "../../components/Callout";
import { useT } from "../../i18n";

const STATE = `stateDiagram-v2
  [*] --> INITIALIZED
  INITIALIZED --> DATA_CAPTURE
  DATA_CAPTURE --> READY_FOR_VALIDATION
  READY_FOR_VALIDATION --> READY_FOR_APPROVAL
  READY_FOR_APPROVAL --> READY_FOR_EXECUTION
  READY_FOR_EXECUTION --> [*]
`;

export function CaseWorkflowConcept() {
  const t = useT();
  const p = t.pages.conceptCaseWorkflow;

  const TOC = [
    { id: "entities", label: p.sec.entities, level: 2 as const },
    { id: "lifecycle", label: p.sec.lifecycle, level: 2 as const },
    { id: "workflow", label: p.sec.workflow, level: 2 as const },
  ];

  return (
    <Layout toc={TOC}>
      <PageHeader eyebrow={p.eyebrow} title={p.title} description={p.description} />

      <h2 id="entities">{p.sec.entities}</h2>
      <ul className="list-disc pl-6 space-y-1 text-slate-600">
        <li>
          <strong>Client</strong> — {p.entityClient}
        </li>
        <li>
          <strong>Case</strong> — {p.entityCase}
        </li>
        <li>
          <strong>Workflow</strong> — {p.entityWorkflow}
        </li>
        <li>
          <strong>Assessment (AI-xx)</strong> — {p.entityAssessment}
        </li>
      </ul>

      <h2 id="lifecycle">{p.sec.lifecycle}</h2>
      <p>{p.lifecycleBody}</p>

      <h2 id="workflow">{p.sec.workflow}</h2>
      <Mermaid chart={STATE} caption={p.stateCaption} />
      <Callout tone="info">{p.workflowNote}</Callout>
    </Layout>
  );
}
