/**
 * Mirrors backend SecurityConfig role rules for portal UI (hide actions that would return 403).
 */

export type PortalCapabilities = {
  /** GET list cases, workflows — RM, WM, IM, ADMIN */
  canUseStaffDataApis: boolean;
  /** POST /api/cases */
  canCreateCase: boolean;
  /** POST discovery check on case */
  canRunDiscoveryCheck: boolean;
  /** POST plans, draft, recommendations */
  canUsePlanningWorkspace: boolean;
  /** POST /execution/instructions */
  canCreateExecutionInstruction: boolean;
  /** POST /execution/send (+ results) */
  canSendExecutionInstruction: boolean;
  /** /api/admin/users, /api/admin/clients */
  canManagePortalUsers: boolean;
  /** Investments demo — aligned with WM-heavy UI */
  canViewInvestments: boolean;
  /** CRUD case_phase / ai_interaction / ai_llm_profile (ADMIN) */
  canManageAiEngineCatalog: boolean;
  /** Discovery questionnaire & answers (RM, WM, IM, ADMIN) */
  canUseDiscoveryQuestionnaire: boolean;
  /** Discovery QID → system_field mappings (ADMIN) */
  canManageDiscoveryMappings: boolean;
};

function hasRole(roles: string[], ...allowed: string[]): boolean {
  const upper = allowed.map((a) => a.toUpperCase());
  return roles.some((r) => upper.includes(String(r).toUpperCase()));
}

export function buildPortalCapabilities(roles: string[]): PortalCapabilities {
  return {
    canUseStaffDataApis: hasRole(roles, 'RM', 'WM', 'IM', 'ADMIN'),
    canCreateCase: hasRole(roles, 'RM', 'ADMIN'),
    canRunDiscoveryCheck: hasRole(roles, 'RM', 'ADMIN'),
    canUsePlanningWorkspace: hasRole(roles, 'WM', 'ADMIN'),
    canCreateExecutionInstruction: hasRole(roles, 'IM', 'ADMIN'),
    canSendExecutionInstruction: hasRole(roles, 'ADMIN'),
    canManagePortalUsers: hasRole(roles, 'ADMIN'),
    canViewInvestments: hasRole(roles, 'WM', 'ADMIN'),
    canManageAiEngineCatalog: hasRole(roles, 'ADMIN'),
    canUseDiscoveryQuestionnaire: hasRole(roles, 'RM', 'WM', 'IM', 'ADMIN'),
    canManageDiscoveryMappings: hasRole(roles, 'ADMIN'),
  };
}

export function defaultPortalCapabilities(): PortalCapabilities {
  return buildPortalCapabilities([]);
}
