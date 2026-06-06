"""Loader for client goals from the ``goal`` table."""

from __future__ import annotations

from typing import Any

from psycopg import Connection
from psycopg.errors import UndefinedTable
from psycopg.rows import dict_row

from app.infrastructure.data_loaders.registry import DataLoader


def select_goals(conn: Connection, client_id: str) -> list[dict[str, Any]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                g.id::text     AS goal_id,
                g.goal_type,
                g.target_amount,
                g.created_at
            FROM goal g
            WHERE g.client_id = %s::uuid
            ORDER BY g.goal_type ASC, g.target_amount DESC
            """,
            (client_id,),
        )
        return [dict(r) for r in cur.fetchall()]


class GoalLoader(DataLoader):

    @property
    def section_id(self) -> str:
        return "goals"

    def load(
        self,
        conn: Connection,
        *,
        client_id: str,
        case_id: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            rows = select_goals(conn, client_id)
        except UndefinedTable:
            return {"items": [], "note": "goal table missing"}

        items = [
            {
                "goal_id": r["goal_id"],
                "goal_type": r.get("goal_type"),
                "target_amount": float(r["target_amount"]) if r.get("target_amount") is not None else None,
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            }
            for r in rows
        ]
        total_target = sum(float(r.get("target_amount") or 0) for r in rows)
        by_type: dict[str, float] = {}
        for r in rows:
            t = r.get("goal_type") or "UNKNOWN"
            by_type[t] = by_type.get(t, 0) + float(r.get("target_amount") or 0)

        return {
            "items": items,
            "count": len(items),
            "total_target_amount": total_target,
            "breakdown_by_type": by_type,
        }
