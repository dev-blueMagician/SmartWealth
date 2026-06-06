from __future__ import annotations

from uuid import uuid4

from app.domain.smartwealth.interfaces.ports import (
    ContextDataRepository,
    ContextResolver,
)
from app.domain.smartwealth.interaction_catalog import get_interaction_spec, spec_to_catalog_view
from app.domain.smartwealth.models import OrchestrationContext, OrchestrationRequest


class RepositoryBackedContextResolver(ContextResolver):
    """Build orchestration context from repository data."""

    def __init__(
        self,
        context_data_repository: ContextDataRepository,
    ) -> None:
        self._context_data_repository = context_data_repository

    def resolve(self, request: OrchestrationRequest) -> OrchestrationContext:
        session_id = self._context_data_repository.get_session_id(request.request_id)
        environment = self._context_data_repository.get_environment(request.request_id)
        feature_flags = self._context_data_repository.get_feature_flags(request.request_id)
        variables = self._context_data_repository.get_variables(request.request_id)

        current_step = self._context_data_repository.get_current_step(request.request_id)
        attempt_count = self._context_data_repository.get_attempt_count(request.request_id)
        previous_result_ids = self._context_data_repository.get_previous_result_ids(request.request_id)
        escalation_required = self._context_data_repository.is_escalation_required(request.request_id)
        human_approval_status = self._context_data_repository.get_human_approval_status(request.request_id)
        human_approver_id = self._context_data_repository.get_human_approver_id(request.request_id)
        human_approval_at = self._context_data_repository.get_human_approval_at(request.request_id)

        ssot_snapshot_id = self._context_data_repository.get_ssot_snapshot_id(request.request_id)

        spec = get_interaction_spec(request.assessment_code)
        if spec is None:
            raise ValueError(
                f"No interaction catalog entry for assessment_code={request.assessment_code!r}"
            )
        catalog_view = spec_to_catalog_view(spec)

        required_fields = {
            "session_id": session_id,
            "environment": environment,
            "feature_flags": feature_flags,
            "variables": variables,
            "current_step": current_step,
            "attempt_count": attempt_count,
            "previous_result_ids": previous_result_ids,
            "escalation_required": escalation_required,
            "human_approval_status": human_approval_status,
            "ssot_snapshot_id": ssot_snapshot_id,
        }
        missing_fields = [field_name for field_name, value in required_fields.items() if value is None]
        if missing_fields:
            missing_csv = ", ".join(sorted(missing_fields))
            raise ValueError(f"Missing required context data: {missing_csv}")

        return OrchestrationContext(
            context_id=str(uuid4()),
            request_id=request.request_id,
            session_id=session_id,
            current_step=current_step,
            attempt_count=attempt_count,
            environment=environment,
            feature_flags=feature_flags,
            variables=variables,
            previous_result_ids=previous_result_ids,
            escalation_required=escalation_required,
            confidence_threshold=request.confidence_threshold,
            human_approval_required=request.human_approval_required,
            human_approval_status=human_approval_status,
            human_approver_id=human_approver_id or "",
            human_approval_at=human_approval_at,
            ssot_record_id=request.ssot_record_id,
            ssot_record_type=request.ssot_record_type,
            ssot_record_version=request.ssot_record_version,
            ssot_snapshot_id=ssot_snapshot_id,
            assessment_code=request.assessment_code,
            catalog=catalog_view,
            input_text=request.input_text or "",
            input_language=request.input_language or "en",
        )
