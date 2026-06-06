"""Utility to load prompt strings from JSON files in the prompts/ directory."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path

_PROMPTS_DIR = Path(__file__).resolve().parent


@lru_cache(maxsize=1)
def _load_common_rules() -> str:
    filepath = _PROMPTS_DIR / "common_rules.json"
    with filepath.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data["prompt"]


@lru_cache(maxsize=64)
def _load_raw(name: str) -> str:
    filepath = _PROMPTS_DIR / f"{name}.json"
    with filepath.open("r", encoding="utf-8") as f:
        data = json.load(f)
    return data["prompt"]


def load_prompt(name: str, *, include_common: bool = False) -> str:
    """
    Load the ``prompt`` field from ``<name>.json`` inside the prompts folder.

    When *include_common* is ``True``, the shared rules from
    ``common_rules.json`` are appended automatically.

    Raises FileNotFoundError if the JSON file does not exist,
    and KeyError if the ``prompt`` key is missing.
    """
    text = _load_raw(name)
    if include_common:
        text += _load_common_rules()
    return text
