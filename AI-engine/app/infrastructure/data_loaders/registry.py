"""Core interface and registry for composable data loaders."""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any

from psycopg import Connection


class DataLoader(ABC):
    """
    Contract for a single data-domain loader.

    Each implementation owns one section of the client profile snapshot
    (e.g. identity, household, assets, goals).
    """

    @property
    @abstractmethod
    def section_id(self) -> str:
        """Unique key used in ``sections`` list and snapshot output."""
        raise NotImplementedError

    @abstractmethod
    def load(
        self,
        conn: Connection,
        *,
        client_id: str,
        case_id: str | None = None,
        params: dict[str, Any] | None = None,
    ) -> dict[str, Any] | list[dict[str, Any]] | None:
        """
        Query DB and return structured data for this section.

        ``params`` allows per-loader configuration from catalog ``tool_config``.
        Implementations must handle missing tables gracefully (return None).
        """
        raise NotImplementedError


_DEFAULT_SECTIONS: tuple[str, ...] = ("identity", "household", "documents")


class LoaderRegistry:
    """
    Holds registered ``DataLoader`` instances and orchestrates selective loading.
    """

    def __init__(self, loaders: list[DataLoader] | None = None) -> None:
        self._loaders: dict[str, DataLoader] = {}
        for loader in loaders or []:
            self.register(loader)

    def register(self, loader: DataLoader) -> None:
        self._loaders[loader.section_id] = loader

    @property
    def available_sections(self) -> tuple[str, ...]:
        return tuple(self._loaders.keys())

    def load(
        self,
        conn: Connection,
        *,
        client_id: str,
        case_id: str | None = None,
        sections: list[str] | tuple[str, ...] | None = None,
        loader_params: dict[str, dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Run requested loaders and assemble the snapshot dict.

        ``sections`` defaults to ``_DEFAULT_SECTIONS`` for backward compatibility.
        ``loader_params`` maps ``section_id`` → per-loader params dict.
        """
        requested = list(sections) if sections else list(_DEFAULT_SECTIONS)
        params_map = loader_params or {}
        snapshot: dict[str, Any] = {}

        for section in requested:
            loader = self._loaders.get(section)
            if loader is None:
                snapshot[section] = {"error": f"unknown loader section: {section}"}
                continue
            try:
                result = loader.load(
                    conn,
                    client_id=client_id,
                    case_id=case_id,
                    params=params_map.get(section),
                )
                snapshot[section] = result
            except Exception as exc:
                snapshot[section] = {"error": f"{type(exc).__name__}: {exc}"}

        return snapshot


def default_loader_registry() -> LoaderRegistry:
    """Build registry with all built-in loaders."""
    from app.infrastructure.data_loaders.identity_loader import IdentityLoader
    from app.infrastructure.data_loaders.household_loader import HouseholdLoader
    from app.infrastructure.data_loaders.document_loader import DocumentLoader
    from app.infrastructure.data_loaders.asset_loader import AssetLoader
    from app.infrastructure.data_loaders.goal_loader import GoalLoader

    return LoaderRegistry([
        IdentityLoader(),
        HouseholdLoader(),
        DocumentLoader(),
        AssetLoader(),
        GoalLoader(),
    ])
