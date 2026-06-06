"""Loader for client assets from the ``asset`` table."""

from __future__ import annotations

from typing import Any

from psycopg import Connection
from psycopg.errors import UndefinedTable
from psycopg.rows import dict_row

from app.infrastructure.data_loaders.registry import DataLoader


def select_assets(conn: Connection, client_id: str) -> list[dict[str, Any]]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            SELECT
                a.id::text    AS asset_id,
                a.asset_type,
                a.value,
                a.created_at
            FROM asset a
            WHERE a.client_id = %s::uuid
            ORDER BY a.asset_type ASC, a.value DESC
            """,
            (client_id,),
        )
        return [dict(r) for r in cur.fetchall()]


class AssetLoader(DataLoader):

    @property
    def section_id(self) -> str:
        return "assets"

    def load(
        self,
        conn: Connection,
        *,
        client_id: str,
        case_id: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        try:
            rows = select_assets(conn, client_id)
        except UndefinedTable:
            return {"items": [], "total_value": 0, "note": "asset table missing"}

        total = sum(float(r.get("value") or 0) for r in rows)
        items = [
            {
                "asset_id": r["asset_id"],
                "asset_type": r.get("asset_type"),
                "value": float(r["value"]) if r.get("value") is not None else None,
                "created_at": r["created_at"].isoformat() if r.get("created_at") else None,
            }
            for r in rows
        ]
        by_type: dict[str, float] = {}
        for r in rows:
            t = r.get("asset_type") or "UNKNOWN"
            by_type[t] = by_type.get(t, 0) + float(r.get("value") or 0)

        return {
            "items": items,
            "count": len(items),
            "total_value": total,
            "breakdown_by_type": by_type,
        }
