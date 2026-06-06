from __future__ import annotations

from app.application.services.planning_section_enricher import enrich_section_content_from_sources


def test_enrich_thin_section_from_discovery_and_profile() -> None:
    document_template = {
        "sections": [
            {
                "id": "plan_information",
                "title": "Plan Information",
                "include": True,
                "placeholders": ["[Client name / household name]", "[Outstanding balance]"],
            }
        ]
    }
    discovery = {
        "fields": {
            "mortgage_outstanding_balance": {
                "systemField": "mortgage_outstanding_balance",
                "dataItem": "Outstanding mortgage balance",
                "valueText": "1.2 tỷ VND",
            }
        }
    }
    out = enrich_section_content_from_sources(
        document_template,
        {},
        discovery,
        client_profile={"name": "Nguyễn Văn A"},
        context={"generatedAt": "2026-05-28T10:00:00+07:00"},
        template={"name": "Home Loan Mortgage"},
    )
    body = out["plan_information"]
    assert "Client-facing plan template" in body
    assert "Nguyễn Văn A" in body
    assert "1.2 tỷ" in body or "mortgage_outstanding" in body
