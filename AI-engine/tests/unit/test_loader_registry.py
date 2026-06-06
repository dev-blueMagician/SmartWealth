"""Tests for the DataLoader registry and built-in loaders."""

from __future__ import annotations

from typing import Any
from unittest.mock import MagicMock

import pytest

from app.infrastructure.data_loaders.registry import DataLoader, LoaderRegistry


class _StubLoader(DataLoader):
    def __init__(self, section: str, data: Any = None, *, fail: bool = False):
        self._section = section
        self._data = data
        self._fail = fail

    @property
    def section_id(self) -> str:
        return self._section

    def load(self, conn, *, client_id, case_id=None, params=None):
        if self._fail:
            raise RuntimeError("boom")
        return self._data


def test_registry_load_default_sections():
    reg = LoaderRegistry([
        _StubLoader("identity", {"name": "Duc"}),
        _StubLoader("household", {"spouse": True}),
        _StubLoader("documents", {"by_kind": {}}),
    ])
    conn = MagicMock()
    snap = reg.load(conn, client_id="c1")
    assert snap["identity"] == {"name": "Duc"}
    assert snap["household"] == {"spouse": True}
    assert snap["documents"] == {"by_kind": {}}


def test_registry_load_explicit_sections():
    reg = LoaderRegistry([
        _StubLoader("identity", {"name": "Duc"}),
        _StubLoader("assets", {"count": 3}),
        _StubLoader("goals", {"count": 2}),
    ])
    conn = MagicMock()
    snap = reg.load(conn, client_id="c1", sections=["assets", "goals"])
    assert "identity" not in snap
    assert snap["assets"] == {"count": 3}
    assert snap["goals"] == {"count": 2}


def test_registry_unknown_section():
    reg = LoaderRegistry([_StubLoader("identity", {})])
    conn = MagicMock()
    snap = reg.load(conn, client_id="c1", sections=["identity", "liabilities"])
    assert snap["identity"] == {}
    assert "error" in snap["liabilities"]
    assert "unknown loader section" in snap["liabilities"]["error"]


def test_registry_loader_error_is_captured():
    reg = LoaderRegistry([_StubLoader("assets", fail=True)])
    conn = MagicMock()
    snap = reg.load(conn, client_id="c1", sections=["assets"])
    assert "error" in snap["assets"]
    assert "RuntimeError" in snap["assets"]["error"]


def test_available_sections():
    reg = LoaderRegistry([
        _StubLoader("identity", {}),
        _StubLoader("assets", {}),
    ])
    assert set(reg.available_sections) == {"identity", "assets"}


def test_register_overwrites():
    reg = LoaderRegistry([_StubLoader("identity", {"v": 1})])
    reg.register(_StubLoader("identity", {"v": 2}))
    conn = MagicMock()
    snap = reg.load(conn, client_id="c1", sections=["identity"])
    assert snap["identity"]["v"] == 2


def test_default_registry_has_all_sections():
    from app.infrastructure.data_loaders.registry import default_loader_registry

    reg = default_loader_registry()
    assert set(reg.available_sections) == {
        "identity", "household", "documents", "assets", "goals",
    }


def _make_ctx(*, variables: dict[str, Any], catalog_loop_input: dict[str, Any] | None = None):
    from app.domain.smartwealth.models import InteractionCatalogView, OrchestrationContext
    from app.orchestration.smartwealth.catalog_agent_tool_dispatch import CLIENT_PROFILE_SQL_TOOL

    catalog = InteractionCatalogView(
        loop_input=catalog_loop_input or {},
        catalog_tool_ids=(CLIENT_PROFILE_SQL_TOOL,),
    )
    return OrchestrationContext(
        context_id="ctx-1",
        request_id="req-1",
        session_id="sess-1",
        current_step="s",
        attempt_count=1,
        environment="dev",
        feature_flags={},
        variables=variables,
        previous_result_ids=[],
        escalation_required=False,
        confidence_threshold=0.9,
        human_approval_required=False,
        human_approval_status="NONE",
        human_approver_id="",
        human_approval_at=None,
        ssot_record_id="ssot-1",
        ssot_record_type="t",
        ssot_record_version="v1",
        ssot_snapshot_id="snap-1",
        assessment_code="client_profile_context",
        catalog=catalog,
        input_text="hi",
        input_language="en",
    )


def test_dispatch_sections_from_loop_input():
    from app.orchestration.smartwealth.catalog_agent_tool_dispatch import (
        CLIENT_PROFILE_SQL_TOOL,
        build_catalog_tool_input,
    )

    ctx = _make_ctx(
        variables={"case_id": "case-1", "client_id": "cl-1"},
        catalog_loop_input={"loader_sections": ["identity", "assets", "goals"]},
    )
    inp = build_catalog_tool_input(CLIENT_PROFILE_SQL_TOOL, context=ctx)
    assert inp["sections"] == ["identity", "assets", "goals"]
    assert inp["case_id"] == "case-1"


def test_dispatch_no_sections_when_absent():
    from app.orchestration.smartwealth.catalog_agent_tool_dispatch import (
        CLIENT_PROFILE_SQL_TOOL,
        build_catalog_tool_input,
    )

    ctx = _make_ctx(
        variables={"case_id": "c1", "client_id": "c2"},
    )
    inp = build_catalog_tool_input(CLIENT_PROFILE_SQL_TOOL, context=ctx)
    assert "sections" not in inp
