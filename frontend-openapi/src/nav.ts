import type { Dict } from "./i18n/dict";

export type NavBadge = "new" | "beta" | "deprecated";

export type NavItem = {
  to: string;
  label: string;
  badge?: NavBadge;
};

export type NavGroup = {
  title: string;
  items: NavItem[];
};

/** Build nav from current locale dictionary so labels translate live. */
export function buildNav(t: Dict): NavGroup[] {
  return [
    {
      title: t.nav.groups.getStarted,
      items: [
        { to: "/", label: t.nav.items.intro },
        { to: "/authentication", label: t.nav.items.auth },
        { to: "/quickstart", label: t.nav.items.quickstart, badge: "new" },
      ],
    },
    {
      title: t.nav.groups.guides,
      items: [
        { to: "/guides/onboarding-case", label: t.nav.items.onboarding },
        { to: "/guides/discovery", label: t.nav.items.discovery },
        { to: "/guides/discovery-check", label: t.nav.items.discoveryCheck },
        { to: "/guides/plan-recommendation", label: t.nav.items.planRec },
        { to: "/guides/decision-execution", label: t.nav.items.decisionExec },
        { to: "/guides/ai-catalog", label: t.nav.items.aiCatalog },
        { to: "/guides/chat-channel", label: t.nav.items.chatChannel, badge: "new" },
      ],
    },
    {
      title: t.nav.groups.concepts,
      items: [
        { to: "/concepts/case-workflow", label: t.nav.items.caseWorkflow },
        { to: "/concepts/catalog-ssot", label: t.nav.items.catalogSsot },
        { to: "/concepts/idempotency", label: t.nav.items.idempotency },
      ],
    },
    {
      title: t.nav.groups.reference,
      items: [
        { to: "/api-reference", label: t.nav.items.apiRef },
        { to: "/webhooks", label: t.nav.items.webhooks },
        { to: "/errors", label: t.nav.items.errors },
        { to: "/changelog", label: t.nav.items.changelog },
      ],
    },
  ];
}
