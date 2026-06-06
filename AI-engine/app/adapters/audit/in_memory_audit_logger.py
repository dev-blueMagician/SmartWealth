from __future__ import annotations

from collections import defaultdict

from app.domain.smartwealth.interfaces.ports import AuditLogger
from app.domain.smartwealth.models import AuditEvent


class InMemoryAuditLogger(AuditLogger):
    def __init__(self) -> None:
        self._events: dict[str, list[AuditEvent]] = defaultdict(list)

    def append(self, event: AuditEvent) -> None:
        self._events[event.workflow_id].append(event)

    def list_by_workflow(self, workflow_id: str) -> list[AuditEvent]:
        return list(self._events.get(workflow_id, []))
