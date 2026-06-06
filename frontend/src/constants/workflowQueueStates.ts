/**
 * Labels for workflow_event transitions (AI-engine seed / workflow_ai_trigger.to_state).
 * Keep in sync with Postgres triggers you seed for each assessment.
 */
export const WorkflowQueueState = {
  DATA_CAPTURE: 'DATA_CAPTURE',
  READY_FOR_VALIDATION: 'READY_FOR_VALIDATION',
  DISCOVERY_READY: 'DISCOVERY_READY',
  PLAN_DRAFT_READY: 'PLAN_DRAFT_READY',
} as const;

export type WorkflowQueueStateValue = (typeof WorkflowQueueState)[keyof typeof WorkflowQueueState];

/** Canonical ordered chain (DATA_CAPTURE → … → PLAN_DRAFT_READY). */
export const WORKFLOW_QUEUE_STATE_ORDER: readonly WorkflowQueueStateValue[] = [
  WorkflowQueueState.DATA_CAPTURE,
  WorkflowQueueState.READY_FOR_VALIDATION,
  WorkflowQueueState.DISCOVERY_READY,
  WorkflowQueueState.PLAN_DRAFT_READY,
];

export const CUSTOM_QUEUE_SELECT_VALUE = '__custom__';

export type WorkflowQueueToStatesPreset = {
  id: string;
  label: string;
  /** Comma-separated targets for seed chain (after start_from_state). */
  value: string;
};

export const WORKFLOW_QUEUE_TO_STATES_PRESETS: readonly WorkflowQueueToStatesPreset[] = [
  { id: 'single_rfv', label: 'READY_FOR_VALIDATION', value: 'READY_FOR_VALIDATION' },
  {
    id: 'two_step',
    label: 'READY_FOR_VALIDATION → DISCOVERY_READY',
    value: 'READY_FOR_VALIDATION, DISCOVERY_READY',
  },
  {
    id: 'full_chain',
    label: 'READY_FOR_VALIDATION → DISCOVERY_READY → PLAN_DRAFT_READY',
    value: 'READY_FOR_VALIDATION, DISCOVERY_READY, PLAN_DRAFT_READY',
  },
];

export function normalizeToStatesList(raw: string): string[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function canonicalToStatesKey(raw: string): string {
  return normalizeToStatesList(raw).join('|');
}

/** Select value for start_from_state dropdown, or CUSTOM_QUEUE_SELECT_VALUE. */
export function resolveStartFromSelectValue(current: string): string {
  const v = current.trim();
  if ((WORKFLOW_QUEUE_STATE_ORDER as readonly string[]).includes(v)) return v;
  return CUSTOM_QUEUE_SELECT_VALUE;
}

/** Select value matching a preset to_states string, or CUSTOM_QUEUE_SELECT_VALUE. */
export function resolveToStatesSelectValue(current: string): string {
  const key = canonicalToStatesKey(current);
  if (!key) return CUSTOM_QUEUE_SELECT_VALUE;
  const match = WORKFLOW_QUEUE_TO_STATES_PRESETS.find((p) => canonicalToStatesKey(p.value) === key);
  return match ? match.value : CUSTOM_QUEUE_SELECT_VALUE;
}
