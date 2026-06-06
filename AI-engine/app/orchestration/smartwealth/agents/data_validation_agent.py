from __future__ import annotations

from dataclasses import dataclass


@dataclass(slots=True)
class ValidationResult:
    is_valid: bool
    errors: list[str]


class DataValidationAgent:
    """
    Stateless validation agent for minimum payload checks.
    Business-specific validation rules must be added only after explicit requirements.
    """

    agent_id = "data_validation_agent"

    def validate(self, payload: dict) -> ValidationResult:
        if not payload:
            return ValidationResult(is_valid=False, errors=["Payload must not be empty."])
        return ValidationResult(is_valid=True, errors=[])
