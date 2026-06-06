from __future__ import annotations

from app.domain.smartwealth.models import WorkflowStatus


TERMINAL_STATES: set[WorkflowStatus] = {
    WorkflowStatus.HUMAN_APPROVED,
    WorkflowStatus.HUMAN_REJECTED,
}

AI_EXECUTABLE_STATES: set[WorkflowStatus] = {
    WorkflowStatus.RECEIVED,
    WorkflowStatus.VALIDATED,
    WorkflowStatus.DRAFTED,
}
