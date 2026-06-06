from app.infrastructure.context.phase_assessment_context_enrichment import merge_string_dicts


def test_merge_string_dicts_overlay_wins_on_key_clash() -> None:
    base = {"a": "1", "b": "2"}
    overlay = {"b": "3", "c": "4"}
    assert merge_string_dicts(base, overlay) == {"a": "1", "b": "3", "c": "4"}
