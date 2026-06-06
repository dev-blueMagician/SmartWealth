from __future__ import annotations

from app.application.services.planning_export_placeholders import build_export_placeholders


def test_build_export_placeholders_merges_narratives_and_mapping_keys() -> None:
    out = build_export_placeholders(
        narratives={
            "executiveSummary": "Tóm lược thử nghiệm.",
            "situationAnalysis": "Phân tích.",
            "recommendations": "Khuyến nghị.",
            "dataQualityNotes": "OK",
        },
        context={"clientId": "c1", "caseId": "case1", "generatedAt": "2026-05-28"},
        template={"code": "HOME", "name": "Home loan"},
        mapping_json={"placeholders": {"{{CUSTOM_TAG}}": "aiNarratives.executiveSummary"}},
        llm_export=None,
    )
    assert out["{{EXECUTIVE_SUMMARY}}"] == "Tóm lược thử nghiệm."
    assert out["{{CLIENT_ID}}"] == "c1"
    assert out["{{CUSTOM_TAG}}"] == "Tóm lược thử nghiệm."


def test_build_export_placeholders_resolves_discovery_field_path() -> None:
    out = build_export_placeholders(
        narratives={},
        context={"clientProfile": {"name": "Nguyễn Văn A"}},
        template={},
        mapping_json={"placeholders": {"[Outstanding balance]": "discovery.fields.mortgage_balance"}},
        llm_export=None,
        discovery={
            "fields": {
                "mortgage_balance": {"systemField": "mortgage_balance", "valueText": "2.500.000.000 VND"},
            }
        },
    )
    assert out["[Outstanding balance]"] == "2.500.000.000 VND"
    assert out["[Client name / household name]"] == "Nguyễn Văn A"
