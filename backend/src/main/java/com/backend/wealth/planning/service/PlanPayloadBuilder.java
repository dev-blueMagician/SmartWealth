package com.backend.wealth.planning.service;

import com.backend.wealth.client.model.Client;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.discovery.dto.CaseDiscoveryDatasetResponse;
import com.backend.wealth.discovery.dto.UnmappedDiscoveryAnswerResponse;
import com.backend.wealth.discovery.service.DiscoveryProjectionService;
import com.backend.wealth.planning.model.PlanTemplate;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PlanPayloadBuilder {

    private final DiscoveryProjectionService discoveryProjectionService;
    private final ClientRepository clientRepository;

    public Map<String, Object> build(
            UUID caseId,
            UUID clientId,
            PlanTemplate template,
            Map<String, Object> assumptions,
            boolean markReadyForReview
    ) {
        CaseDiscoveryDatasetResponse dataset = discoveryProjectionService.getDataset(caseId);

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("templateCode", template.getCode());
        payload.put("templateVersion", template.getVersionNo());
        payload.put("templateLocale", template.getLocale());
        payload.put("generatedAt", OffsetDateTime.now().toString());
        payload.put("caseId", caseId.toString());
        payload.put("clientId", clientId.toString());
        payload.put("assumptions", assumptions == null ? Map.of() : assumptions);
        payload.put("clientProfile", buildClientProfile(clientId));

        Map<String, Object> discovery = new LinkedHashMap<>();
        discovery.put("mandatoryFieldsTotal", dataset.mandatoryFieldsTotal());
        discovery.put("mandatoryFieldsFilled", dataset.mandatoryFieldsFilled());
        discovery.put("mandatoryFieldsMissing", dataset.mandatoryFieldsMissing());
        discovery.put("fieldCount", dataset.fields().size());
        discovery.put("unmappedCount", dataset.unmappedAnswers().size());
        discovery.put("fields", dataset.fields());
        discovery.put("unmappedAnswers", toUnmappedMaps(dataset.unmappedAnswers()));
        payload.put("discovery", discovery);

        payload.put("keyMetrics", Map.of(
                "mandatoryCoverageRatio",
                dataset.mandatoryFieldsTotal() == 0
                        ? 1.0
                        : ((double) dataset.mandatoryFieldsFilled() / (double) dataset.mandatoryFieldsTotal()),
                "readyForReview", markReadyForReview && dataset.mandatoryFieldsMissing() == 0
        ));

        payload.put("aiNarratives", Map.of(
                "executiveSummary", buildExecutiveSummary(dataset),
                "dataQualityNotes", buildDataQualityNotes(dataset)
        ));
        return payload;
    }

    private Map<String, Object> buildClientProfile(UUID clientId) {
        return clientRepository.findById(clientId)
                .map(this::toClientProfileMap)
                .orElse(Map.of());
    }

    private Map<String, Object> toClientProfileMap(Client client) {
        Map<String, Object> profile = new LinkedHashMap<>();
        putIfPresent(profile, "name", client.getName());
        putIfPresent(profile, "riskProfile", client.getRiskProfile());
        putIfPresent(profile, "residency", client.getResidency());
        putIfPresent(profile, "dateOfBirth", client.getDateOfBirth() == null ? null : client.getDateOfBirth().toString());
        putIfPresent(profile, "maritalStatus", client.getMaritalStatus());
        putIfPresent(profile, "nationality", client.getNationality());
        putIfPresent(profile, "primaryPhone", client.getPrimaryPhone());
        putIfPresent(profile, "primaryEmail", client.getPrimaryEmail());
        putIfPresent(profile, "contactAddress", client.getContactAddress());
        putIfPresent(profile, "status", client.getStatus());
        return profile;
    }

    private static List<Map<String, Object>> toUnmappedMaps(List<UnmappedDiscoveryAnswerResponse> answers) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (answers == null) {
            return rows;
        }
        for (UnmappedDiscoveryAnswerResponse answer : answers) {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("questionId", answer.questionId());
            row.put("blockIndex", answer.blockIndex());
            row.put("answerValue", answer.answerValue());
            row.put("mappingSystemField", answer.mappingSystemField());
            rows.add(row);
        }
        return rows;
    }

    private static void putIfPresent(Map<String, Object> target, String key, String value) {
        if (value != null && !value.isBlank()) {
            target.put(key, value);
        }
    }

    private String buildExecutiveSummary(CaseDiscoveryDatasetResponse dataset) {
        if (dataset.mandatoryFieldsMissing() > 0) {
            return "Planning draft generated with missing mandatory discovery fields. "
                    + "Complete required data before finalization.";
        }
        return "Planning draft generated from discovery dataset with mandatory fields satisfied. "
                + "Review assumptions and strategy sections before client presentation.";
    }

    private String buildDataQualityNotes(CaseDiscoveryDatasetResponse dataset) {
        if (dataset.unmappedAnswers().isEmpty()) {
            return "No unmapped discovery answers detected.";
        }
        return "There are " + dataset.unmappedAnswers().size()
                + " answered questions without valid system-field mapping.";
    }
}
