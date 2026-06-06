"""Read ``case_phase`` + ``ai_interaction`` rows from PostgreSQL."""

from __future__ import annotations

import json
from typing import Any

import psycopg
from psycopg.rows import dict_row


def fetch_ai_interaction_catalog(conninfo: str) -> dict[str, tuple[dict[str, Any], str | None]]:
    """
    Return ``interaction_id`` → ``(loop_input dict, system_prompt or None)``.

    Raises if the query fails (missing tables, connection error, etc.).
    """
    with psycopg.connect(conninfo) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT interaction_id, loop_input, system_prompt
                FROM ai_interaction
                ORDER BY interaction_id
                """
            )
            rows = cur.fetchall()
    out: dict[str, tuple[dict[str, Any], str | None]] = {}
    for row in rows:
        iid = row["interaction_id"]
        li: Any = row["loop_input"]
        if isinstance(li, str):
            li = json.loads(li)
        if not isinstance(li, dict):
            raise TypeError(
                f"ai_interaction.loop_input for {iid!r} must be a JSON object, got {type(li).__name__}"
            )
        raw_sp = row.get("system_prompt")
        sp: str | None
        if isinstance(raw_sp, str) and raw_sp.strip():
            sp = raw_sp.strip()
        else:
            sp = None
        out[str(iid)] = (li, sp)
    return out


def fetch_case_phase_manifest_dict(conninfo: str) -> dict[str, Any]:
    """
    Build a manifest-shaped dict: ``version``, ``phases`` (phase_code → list of interaction_id).

    ``catalog_version`` is taken from any ``case_phase`` row (they should match after seed).
    """
    with psycopg.connect(conninfo) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT cp.phase_code, cp.sort_order, cp.catalog_version, ai.interaction_id
                FROM case_phase cp
                INNER JOIN ai_interaction ai ON ai.phase_code = cp.phase_code
                WHERE cp.enabled = true
                ORDER BY cp.sort_order, ai.interaction_id
                """
            )
            rows = cur.fetchall()
    if not rows:
        raise ValueError("case_phase / ai_interaction catalog is empty")
    version = str(rows[0]["catalog_version"])
    phases: dict[str, list[str]] = {}
    for row in rows:
        pc = str(row["phase_code"])
        phases.setdefault(pc, []).append(str(row["interaction_id"]))
    return {
        "version": version,
        "description": "Parent manifest from PostgreSQL (case_phase + ai_interaction).",
        "phases": phases,
    }
