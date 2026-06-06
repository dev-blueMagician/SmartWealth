#!/usr/bin/env python3
"""
Render the interaction catalog prompt (``system_prompt`` + ``loop_input``) and call the configured LLM.

Requires credentials for ``LLM_PROVIDER`` (default ``deepseek``): ``DEEPSEEK_API_KEY``, or for Azure
``LLM_PROVIDER=azure_openai`` plus ``AZURE_OPENAI_ENDPOINT``, ``AZURE_OPENAI_API_KEY``,
``AZURE_OPENAI_DEPLOYMENT``.

Example::

  cd SmartWealth && pip install -e ".[dev]"
  export DEEPSEEK_API_KEY=sk-...
  python AI-engine/scripts/try_deepseek_prompt.py --assessment-code onboarding_completeness
  python AI-engine/scripts/try_deepseek_prompt.py --assessment-code client_explain_onboarding --variables-json '{"screen":"kyc","field":"national_id"}'
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from app.infrastructure.config.settings import Settings  # noqa: E402
from app.infrastructure.llm import LlmChatClient, chat_completion_adapter_from_settings  # noqa: E402
from app.infrastructure.prompts import render_interaction_prompt  # noqa: E402
from app.orchestration.assessment.codes import AssessmentCode  # noqa: E402


def _build_user_message(variables: dict[str, object], input_text: str) -> str:
    parts = [
        "## Variables (structured runtime / SSOT slice)",
        json.dumps(variables, ensure_ascii=False, indent=2),
    ]
    if input_text.strip():
        parts.extend(["", "## Free-form input_text from orchestration request", input_text.strip()])
    return "\n".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description="Try LLM (DeepSeek or Azure OpenAI) with rendered prompt.")
    parser.add_argument(
        "--assessment-code",
        default=AssessmentCode.ONBOARDING_COMPLETENESS.value,
        help=(
            "Assessment / interaction id in interaction_catalog "
            f"(default: {AssessmentCode.ONBOARDING_COMPLETENESS.value})."
        ),
    )
    parser.add_argument(
        "--variables-json",
        default="{}",
        help='JSON object merged into the user message (default: "{}").',
    )
    parser.add_argument(
        "--input-text",
        default="",
        help="Optional free-form text appended to the user message (simulates OrchestrationRequest.input_text).",
    )
    parser.add_argument(
        "--print-prompt-only",
        action="store_true",
        help="Render and print the system prompt only; do not call the API.",
    )
    args = parser.parse_args()

    try:
        variables = json.loads(args.variables_json)
        if not isinstance(variables, dict):
            raise ValueError("variables-json must be a JSON object")
    except json.JSONDecodeError as e:
        print(f"Invalid --variables-json: {e}", file=sys.stderr)
        return 2

    settings = Settings()
    system = render_interaction_prompt(args.assessment_code)
    user = _build_user_message(variables, args.input_text)

    if args.print_prompt_only:
        print("--- system ---")
        print(system)
        print("--- user ---")
        print(user)
        return 0

    try:
        adapter: LlmChatClient = chat_completion_adapter_from_settings(settings)
    except Exception as e:
        print(f"Settings / adapter error: {e}", file=sys.stderr)
        return 2

    try:
        result = adapter.chat(system=system, user=user)
    except Exception as e:
        print(f"LLM request failed: {e}", file=sys.stderr)
        return 3

    print(result.text)
    if result.input_tokens is not None and result.output_tokens is not None:
        print(
            f"\n(tokens: in={result.input_tokens} out={result.output_tokens} model={result.model})",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
