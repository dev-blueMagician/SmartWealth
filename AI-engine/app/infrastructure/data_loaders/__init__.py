"""
Loader registry: composable, per-domain data loaders for client profile snapshots.

Each loader owns one data domain (identity, household, assets, …).
``LoaderRegistry`` selects which loaders run based on caller-requested section names.

Usage::

    registry = default_loader_registry()
    snapshot = registry.load(conn, client_id=cid, case_id=case_id, sections=["identity", "assets", "goals"])
"""

from app.infrastructure.data_loaders.registry import (
    DataLoader,
    LoaderRegistry,
    default_loader_registry,
)

__all__ = [
    "DataLoader",
    "LoaderRegistry",
    "default_loader_registry",
]
