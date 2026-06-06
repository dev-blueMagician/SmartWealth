"""Product interaction registry; loaded from PostgreSQL ``ai_interaction`` (runtime SSOT).

Expected interaction ids match ``AssessmentCode`` values (catalog / triggers / requests use the same strings).
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Final

from app.domain.smartwealth.models import InteractionCatalogView
from app.orchestration.assessment.codes import AssessmentCode


class OrchestratorHook(str, Enum):
    """Named hooks on catalog orchestrator / ports."""

    RECEIVE_TRIGGER_EVENT = "receive_trigger_event"
    BUILD_CONTEXT = "build_context"
    RUN_POLICY_CHECK = "run_policy_check"
    SELECT_AGENT = "select_agent"
    EXECUTE_AGENT = "execute_agent"
    APPLY_CONFIDENCE_GATE = "apply_confidence_gate"
    PRODUCE_RESULT = "produce_result"


ORCHESTRATOR_COLUMN_BINDING: Final[dict[OrchestratorHook, tuple[str, ...]]] = {
    OrchestratorHook.RECEIVE_TRIGGER_EVENT: ("assessment_code",),
    OrchestratorHook.BUILD_CONTEXT: ("loop_input",),
    OrchestratorHook.RUN_POLICY_CHECK: (
        "policy_gates",
    ),
    OrchestratorHook.SELECT_AGENT: ("agent_selection",),
    OrchestratorHook.EXECUTE_AGENT: ("loop_input",),
    OrchestratorHook.APPLY_CONFIDENCE_GATE: (
        "stop_escalate",
    ),
    OrchestratorHook.PRODUCE_RESULT: ("output_envelope",),
}


@dataclass(frozen=True, slots=True)
class InteractionSpec:
    """Catalog row: ``loop_input`` JSON + optional prompt body from ``ai_interaction.system_prompt``."""

    loop_input: dict[str, object]
    system_prompt: str | None = None


def _expected_interaction_ids() -> set[str]:
    return {m.value for m in AssessmentCode}


def _registry_from_pg_rows(
    raw: dict[str, tuple[dict[str, object], str | None]],
) -> dict[str, InteractionSpec]:
    return {k: InteractionSpec(loop_input=li, system_prompt=sp) for k, (li, sp) in raw.items()}


def _interaction_spec_from_seed_entry(iid: str, entry: object) -> InteractionSpec:
    if not isinstance(entry, dict):
        raise ValueError(f"embedded catalog[{iid!r}] must be an object")
    li = entry.get("loop_input")
    if not isinstance(li, dict):
        raise ValueError(f"embedded catalog[{iid!r}].loop_input must be a JSON object")
    raw_sp = entry.get("system_prompt")
    if raw_sp is None:
        sp: str | None = None
    elif isinstance(raw_sp, str):
        sp = raw_sp.strip() or None
    else:
        raise ValueError(f"embedded catalog[{iid!r}].system_prompt must be a string or null")
    return InteractionSpec(loop_input=li, system_prompt=sp)


def _load_interactions_from_postgres() -> dict[str, InteractionSpec]:
    from app.domain.smartwealth.catalog_seed import INTERACTION_CATALOG_SEED
    from app.infrastructure.catalog.postgres_ai_catalog import fetch_ai_interaction_catalog
    from app.infrastructure.config.settings import Settings

    rows = fetch_ai_interaction_catalog(Settings().resolved_database_url)
    got = set(rows.keys())
    exp = _expected_interaction_ids()
    unknown = got - exp
    if unknown:
        raise RuntimeError(
            "postgres ai_interaction has unknown interaction_id values: "
            f"{sorted(unknown)} (expected only AssessmentCode strings)."
        )
    merged = _registry_from_pg_rows(rows)
    missing = sorted(exp - got)
    if missing:
        log = logging.getLogger(__name__)
        log.warning(
            "ai_interaction missing %s; filling from embedded catalog_seed until you re-run "
            "scripts/seed_ai_interaction_catalog.py",
            missing,
        )
        if not isinstance(INTERACTION_CATALOG_SEED, dict):
            raise RuntimeError("INTERACTION_CATALOG_SEED is not a dict; cannot fill missing interactions.")
        for iid in missing:
            entry = INTERACTION_CATALOG_SEED.get(iid)
            if entry is None:
                raise RuntimeError(
                    f"postgres missing {iid!r} and no embedded catalog_seed entry; run seed script."
                )
            merged[iid] = _interaction_spec_from_seed_entry(iid, entry)
    if set(merged.keys()) != exp:
        raise RuntimeError(
            "postgres ai_interaction catalog incomplete after seed merge: "
            f"expected {sorted(exp)}, got {sorted(merged.keys())}"
        )
    return merged


def _load_interactions_from_snapshot(path: Path | None) -> dict[str, InteractionSpec]:
    if path is not None:
        if not path.is_file():
            raise FileNotFoundError(f"Interaction catalog snapshot not found: {path}")
        blob = json.loads(path.read_text(encoding="utf-8"))
        snap_label = str(path)
    else:
        from app.domain.smartwealth.catalog_seed import INTERACTION_CATALOG_SEED

        blob = INTERACTION_CATALOG_SEED
        snap_label = "catalog_seed.INTERACTION_CATALOG_SEED"
    if not isinstance(blob, dict):
        raise ValueError(f"Snapshot must be a JSON object: {snap_label}")
    exp = _expected_interaction_ids()
    if set(blob.keys()) != exp:
        raise ValueError(
            f"Snapshot keys must match AssessmentCode set; expected {sorted(exp)}, got {sorted(blob.keys())}"
        )
    loaded: dict[str, InteractionSpec] = {}
    for iid in sorted(exp):
        entry = blob[iid]
        if not isinstance(entry, dict):
            raise ValueError(f"Snapshot[{iid!r}] must be an object")
        li = entry.get("loop_input")
        if not isinstance(li, dict):
            raise ValueError(f"Snapshot[{iid!r}].loop_input must be a JSON object")
        raw_sp = entry.get("system_prompt")
        if raw_sp is None:
            sp: str | None = None
        elif isinstance(raw_sp, str):
            sp = raw_sp.strip() or None
        else:
            raise ValueError(f"Snapshot[{iid!r}].system_prompt must be a string or null")
        loaded[iid] = InteractionSpec(loop_input=li, system_prompt=sp)
    return loaded


def _catalog_snapshot_path() -> Path | None:
    override = os.environ.get("SMARTWEALTH_INTERACTION_CATALOG_SNAPSHOT", "").strip()
    return Path(override) if override else None


def _build_registry() -> dict[str, InteractionSpec]:
    """
    ``SMARTWEALTH_INTERACTION_CATALOG_SOURCE``:

    - ``postgres`` (default) — ``ai_interaction.loop_input`` + ``system_prompt``; requires full AssessmentCode rows.
    - ``snapshot`` — offline/tests: embedded ``catalog_seed.INTERACTION_CATALOG_SEED``, unless
      ``SMARTWEALTH_INTERACTION_CATALOG_SNAPSHOT`` points at a JSON file.
    """
    src = os.environ.get("SMARTWEALTH_INTERACTION_CATALOG_SOURCE", "postgres").strip().lower()
    if src == "postgres":
        return _load_interactions_from_postgres()
    if src == "snapshot":
        return _load_interactions_from_snapshot(_catalog_snapshot_path())
    raise ValueError(
        f"Unknown SMARTWEALTH_INTERACTION_CATALOG_SOURCE={src!r} "
        "(expected 'postgres' or 'snapshot')"
    )


_REGISTRY: dict[str, InteractionSpec] | None = None


def _interaction_registry() -> dict[str, InteractionSpec]:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = _build_registry()
    return _REGISTRY


def reload_interaction_catalog() -> None:
    """Clear cached registry (e.g. after updating ``ai_interaction`` in DB)."""
    global _REGISTRY
    _REGISTRY = None


class _InteractionsProxy:
    """Lazy map-like view used as ``INTERACTIONS`` for backwards compatibility."""

    __slots__ = ()

    def __getitem__(self, key: str) -> InteractionSpec:
        return _interaction_registry()[key]

    def __contains__(self, key: object) -> bool:
        return key in _interaction_registry()

    def __len__(self) -> int:
        return len(_interaction_registry())

    def get(self, key: str, default: InteractionSpec | None = None) -> InteractionSpec | None:
        return _interaction_registry().get(key, default)

    def keys(self):
        return _interaction_registry().keys()


INTERACTIONS: _InteractionsProxy = _InteractionsProxy()


def get_interaction_spec(interaction_id: str) -> InteractionSpec | None:
    return _interaction_registry().get(interaction_id)


def list_interaction_ids() -> tuple[str, ...]:
    return tuple(_interaction_registry().keys())


def spec_to_catalog_view(spec: InteractionSpec) -> InteractionCatalogView:
    """Map catalog row to runtime view attached to ``OrchestrationContext``."""
    li = spec.loop_input
    tool_ids = _catalog_tool_ids_from_loop_input(li)
    return InteractionCatalogView(loop_input=li, catalog_tool_ids=tool_ids)


def _catalog_tool_ids_from_loop_input(loop_input: dict[str, object]) -> tuple[str, ...]:
    """
    Read ``tools`` from ``loop_input`` (DB / seed JSON).

    Supported shapes:
    - ``"tools": ["client_profile_sql_tool", ...]`` — list of non-empty strings (trimmed).
    - ``"tools": "single_tool_id"`` — one tool id.
    Unknown element types are skipped.
    """
    raw = loop_input.get("tools")
    if raw is None:
        return ()
    if isinstance(raw, str):
        s = raw.strip()
        return (s,) if s else ()
    if isinstance(raw, list):
        out: list[str] = []
        for x in raw:
            if isinstance(x, str):
                t = x.strip()
                if t:
                    out.append(t)
        return tuple(out)
    return ()
