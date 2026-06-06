#!/usr/bin/env python3
"""
Upsert ``case_phase`` and ``ai_interaction`` from embedded bootstrap data (``catalog_seed``).

Run from repo root or AI-engine directory (requires DATABASE_URL or DB_* in .env):

    python scripts/seed_ai_interaction_catalog.py
"""

from __future__ import annotations

import sys
from pathlib import Path

import psycopg
from psycopg.types.json import Json

_ROOT = Path(__file__).resolve().parents[1]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from app.domain.smartwealth.case_phase_manifest import list_phase_keys_in_order  # noqa: E402
from app.domain.smartwealth.catalog_seed import (  # noqa: E402
    CASE_PHASE_ASSESSMENT_MANIFEST,
    INTERACTION_CATALOG_SEED,
)
from app.orchestration.assessment.codes import AssessmentCode  # noqa: E402
from app.infrastructure.config.settings import Settings  # noqa: E402


def main() -> None:
    manifest = CASE_PHASE_ASSESSMENT_MANIFEST
    phases_map = manifest["phases"]
    if not isinstance(phases_map, dict):
        raise SystemExit("manifest.phases must be an object")
    catalog_version = str(manifest.get("version", "1"))

    interaction_to_phase: dict[str, str] = {}
    for phase_code, ids in phases_map.items():
        if not isinstance(ids, list):
            raise SystemExit(f"phases[{phase_code!r}] must be a list")
        for iid in ids:
            interaction_to_phase[str(iid)] = str(phase_code)

    for member in AssessmentCode:
        if member.value not in interaction_to_phase:
            raise SystemExit(f"No phase mapping for {member.value} in embedded manifest")

    catalog_blob = INTERACTION_CATALOG_SEED
    if not isinstance(catalog_blob, dict):
        raise SystemExit("INTERACTION_CATALOG_SEED must be a dict")

    settings = Settings()
    conninfo = settings.resolved_database_url

    ordered_phases = list_phase_keys_in_order(manifest)

    with psycopg.connect(conninfo) as conn:
        with conn.cursor() as cur:
            for order, code in enumerate(ordered_phases):
                cur.execute(
                    """
                    INSERT INTO case_phase (phase_code, display_name, sort_order, catalog_version)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (phase_code) DO UPDATE SET
                        display_name = EXCLUDED.display_name,
                        sort_order = EXCLUDED.sort_order,
                        catalog_version = EXCLUDED.catalog_version,
                        updated_at = now()
                    """,
                    (code, code.replace("_", " ").title(), order, catalog_version),
                )

            for member in AssessmentCode:
                iid = member.value
                entry = catalog_blob.get(iid)
                if not isinstance(entry, dict):
                    raise SystemExit(f"embedded catalog: missing or invalid entry for {iid!r}")
                loop_input = entry.get("loop_input")
                if not isinstance(loop_input, dict):
                    raise SystemExit(f"embedded catalog[{iid}].loop_input must be a JSON object")
                phase_code = interaction_to_phase[iid]
                sp_raw = entry.get("system_prompt")
                if sp_raw is None:
                    system_prompt = None
                elif isinstance(sp_raw, str):
                    system_prompt = sp_raw.strip() or None
                else:
                    raise SystemExit(f"embedded catalog[{iid}].system_prompt must be a string or null")
                cur.execute(
                    """
                    INSERT INTO ai_interaction (interaction_id, phase_code, loop_input, system_prompt)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (interaction_id) DO UPDATE SET
                        phase_code = EXCLUDED.phase_code,
                        loop_input = EXCLUDED.loop_input,
                        system_prompt = COALESCE(EXCLUDED.system_prompt, ai_interaction.system_prompt),
                        updated_at = now()
                    """,
                    (iid, phase_code, Json(loop_input), system_prompt),
                )
        conn.commit()

    print(f"Seeded {len(ordered_phases)} case_phase rows and {len(AssessmentCode)} ai_interaction rows.")


if __name__ == "__main__":
    main()
