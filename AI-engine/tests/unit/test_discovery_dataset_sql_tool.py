from app.tools.discovery_dataset_sql_tool import (
    DISCOVERY_DATASET_SQL_TOOL,
    DiscoveryDatasetSqlTool,
    _clamp_int,
)


def test_tool_id() -> None:
    assert DiscoveryDatasetSqlTool().tool_id == DISCOVERY_DATASET_SQL_TOOL


def test_fetch_requires_case_id() -> None:
    out = DiscoveryDatasetSqlTool().fetch({})
    assert out["discovery_summary"] is None
    assert "case_id" in (out.get("error") or "")


def test_clamp_int_defaults() -> None:
    assert _clamp_int(None, default=40, max_val=200) == 40
    assert _clamp_int(999, default=40, max_val=100) == 100
