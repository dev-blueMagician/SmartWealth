"""
Read-only discovery case dataset from ``case_discovery_field`` + ``field_dictionary``.

Returns a **compact** summary for LLM (bounded rows). Full case data stays in the DB;
use ``filled_limit`` / ``missing_limit`` to control token size.
"""

from __future__ import annotations

from typing import Any

from psycopg import Connection
from psycopg.errors import UndefinedColumn, UndefinedTable
from psycopg.rows import dict_row

from app.domain.smartwealth.interfaces import ReadOnlyDataTool
from app.infrastructure.config.settings import Settings
from app.infrastructure.data_loaders.case_resolver import norm_uuid_str

DISCOVERY_DATASET_SQL_TOOL = "discovery_dataset_sql_tool"


class DiscoveryDatasetSqlTool(ReadOnlyDataTool):
    """
    Expects tool_input::

        {
            "case_id": "<uuid>",
            "data_domain": "Goals & Wealth Objectives",  # optional filter
            "filled_limit": 40,
            "missing_limit": 30,
            "unmapped_limit": 15
        }
    """

    @property
    def tool_id(self) -> str:
        return DISCOVERY_DATASET_SQL_TOOL

    def fetch(self, query: dict[str, Any]) -> dict[str, Any]:
        case_id = norm_uuid_str(query.get("case_id"))
        if not case_id:
            return {"discovery_summary": None, "error": "discovery_dataset_sql_tool requires case_id"}

        filled_limit = _clamp_int(query.get("filled_limit"), default=40, max_val=200)
        missing_limit = _clamp_int(query.get("missing_limit"), default=30, max_val=200)
        unmapped_limit = _clamp_int(query.get("unmapped_limit"), default=15, max_val=50)
        data_domain = _optional_str(query.get("data_domain"))

        try:
            settings = Settings()
            conninfo = settings.resolved_database_url
        except Exception as exc:
            return {"discovery_summary": None, "error": f"settings: {exc}"}

        try:
            import psycopg

            with psycopg.connect(conninfo) as conn:
                return self._fetch_summary(
                    conn,
                    case_id=case_id,
                    data_domain=data_domain,
                    filled_limit=filled_limit,
                    missing_limit=missing_limit,
                    unmapped_limit=unmapped_limit,
                )
        except OSError as exc:
            return {"discovery_summary": None, "error": f"database: {exc}"}

    def _fetch_summary(
        self,
        conn: Connection,
        *,
        case_id: str,
        data_domain: str | None,
        filled_limit: int,
        missing_limit: int,
        unmapped_limit: int,
    ) -> dict[str, Any]:
        try:
            stats = self._load_stats(conn, case_id)
            filled_fields = self._load_filled(conn, case_id, data_domain, filled_limit)
            missing_mandatory = self._load_missing_mandatory(
                conn, case_id, data_domain, missing_limit
            )
            unmapped = self._load_unmapped(conn, case_id, unmapped_limit)
            filled_by_domain = self._load_filled_by_domain(conn, case_id)

            return {
                "discovery_summary": {
                    "case_id": case_id,
                    "stats": stats,
                    "filled_fields": filled_fields,
                    "missing_mandatory": missing_mandatory,
                    "unmapped_answers": unmapped,
                    "filled_count_by_domain": filled_by_domain,
                },
                "error": None,
            }
        except (UndefinedTable, UndefinedColumn) as exc:
            return {
                "discovery_summary": None,
                "error": (
                    "schema_mismatch: apply Flyway V9–V11 discovery migrations: "
                    f"{exc}"
                ),
            }

    def _load_stats(self, conn: Connection, case_id: str) -> dict[str, Any]:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                """
                SELECT
                  (SELECT COUNT(*)::int FROM case_discovery_field WHERE case_id = %s::uuid) AS materialized_fields,
                  (SELECT COUNT(*)::int FROM case_discovery_field WHERE case_id = %s::uuid AND status = 'filled') AS filled_count,
                  (SELECT COUNT(*)::int FROM case_discovery_field WHERE case_id = %s::uuid AND status = 'missing') AS missing_materialized_count,
                  (SELECT COUNT(*)::bigint FROM field_dictionary WHERE mandatory_level = 'Mandatory') AS mandatory_fields_total,
                  (SELECT COUNT(*)::bigint FROM field_dictionary fd
                     WHERE fd.mandatory_level = 'Mandatory'
                       AND EXISTS (
                         SELECT 1 FROM case_discovery_field cdf
                         WHERE cdf.case_id = %s::uuid
                           AND cdf.system_field = fd.system_field_name
                           AND cdf.status = 'filled'
                       )) AS mandatory_fields_filled,
                  (SELECT COUNT(*)::bigint FROM field_dictionary fd
                     WHERE fd.mandatory_level = 'Mandatory'
                       AND NOT EXISTS (
                         SELECT 1 FROM case_discovery_field cdf
                         WHERE cdf.case_id = %s::uuid
                           AND cdf.system_field = fd.system_field_name
                           AND cdf.status = 'filled'
                       )) AS mandatory_fields_missing
                """,
                (case_id, case_id, case_id, case_id, case_id),
            )
            row = cur.fetchone() or {}
        return dict(row)

    def _load_filled(
        self,
        conn: Connection,
        case_id: str,
        data_domain: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        domain_clause = ""
        params: list[Any] = [case_id]
        if data_domain:
            domain_clause = " AND fd.data_domain ILIKE %s"
            params.append(f"%{data_domain}%")
        params.append(limit)
        sql = f"""
            SELECT cdf.system_field, cdf.value_text, cdf.question_id, cdf.block_index,
                   fd.data_domain, fd.data_item, fd.detail_field_name
            FROM case_discovery_field cdf
            LEFT JOIN field_dictionary fd ON fd.system_field_name = cdf.system_field
            WHERE cdf.case_id = %s::uuid AND cdf.status = 'filled'
            {domain_clause}
            ORDER BY fd.row_no NULLS LAST, cdf.system_field
            LIMIT %s
        """
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

    def _load_missing_mandatory(
        self,
        conn: Connection,
        case_id: str,
        data_domain: str | None,
        limit: int,
    ) -> list[dict[str, Any]]:
        domain_clause = ""
        params: list[Any] = [case_id]
        if data_domain:
            domain_clause = " AND fd.data_domain ILIKE %s"
            params.append(f"%{data_domain}%")
        params.append(limit)
        sql = f"""
            SELECT fd.system_field_name AS system_field, fd.data_domain, fd.data_item,
                   fd.detail_field_name, fd.mandatory_level
            FROM field_dictionary fd
            WHERE fd.mandatory_level = 'Mandatory'
              AND NOT EXISTS (
                SELECT 1 FROM case_discovery_field cdf
                WHERE cdf.case_id = %s::uuid
                  AND cdf.system_field = fd.system_field_name
                  AND cdf.status = 'filled'
              )
            {domain_clause}
            ORDER BY fd.row_no NULLS LAST, fd.system_field_name
            LIMIT %s
        """
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]

    def _load_unmapped(
        self,
        conn: Connection,
        case_id: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        sql = """
            SELECT qa.question_id, qa.block_index, qa.answer_value,
                   (
                     SELECT m.system_field FROM question_field_mapping m
                     WHERE m.question_id = qa.question_id
                     ORDER BY m.system_field LIMIT 1
                   ) AS mapping_system_field
            FROM question_answer qa
            WHERE qa.case_id = %s::uuid
              AND qa.answer_value IS NOT NULL
              AND qa.answer_value::text NOT IN ('null', '""', '[]')
              AND NOT EXISTS (
                SELECT 1 FROM question_field_mapping m
                JOIN field_dictionary fd ON fd.system_field_name = m.system_field
                WHERE m.question_id = qa.question_id
              )
            ORDER BY qa.question_id, qa.block_index
            LIMIT %s
        """
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, (case_id, limit))
            return [dict(r) for r in cur.fetchall()]

    def _load_filled_by_domain(self, conn: Connection, case_id: str) -> dict[str, int]:
        sql = """
            SELECT COALESCE(fd.data_domain, 'Unknown') AS data_domain, COUNT(*)::int AS cnt
            FROM case_discovery_field cdf
            LEFT JOIN field_dictionary fd ON fd.system_field_name = cdf.system_field
            WHERE cdf.case_id = %s::uuid AND cdf.status = 'filled'
            GROUP BY COALESCE(fd.data_domain, 'Unknown')
            ORDER BY cnt DESC
        """
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, (case_id,))
            return {str(r["data_domain"]): int(r["cnt"]) for r in cur.fetchall()}


def _clamp_int(value: Any, *, default: int, max_val: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = default
    return max(0, min(n, max_val))


def _optional_str(value: Any) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None
