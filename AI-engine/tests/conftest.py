"""Pytest defaults: interaction catalog from embedded ``catalog_seed`` (pytest snapshot mode)."""

from __future__ import annotations

import os

import pytest


@pytest.fixture(scope="session", autouse=True)
def _interaction_catalog_snapshot_for_tests() -> None:
    """
    Unit tests avoid requiring PostgreSQL; catalog matches ``catalog_seed.INTERACTION_CATALOG_SEED``.

    Integration tests against real DB should set ``SMARTWEALTH_INTERACTION_CATALOG_SOURCE=postgres``
    and call ``reload_interaction_catalog()`` after seeding.
    """
    os.environ["SMARTWEALTH_INTERACTION_CATALOG_SOURCE"] = "snapshot"
    from app.domain.smartwealth.interaction_catalog import reload_interaction_catalog

    reload_interaction_catalog()
