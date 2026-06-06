package com.backend.wealth.planning.service;

import com.backend.wealth.discovery.service.DiscoveryProjectionService;
import com.backend.wealth.integration.AiEnginePlanningClient;
import com.backend.wealth.planning.model.PlanTemplate;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanningAgentComposeService {

    private final DiscoveryProjectionService discoveryProjectionService;
    private final PlanPayloadBuilder planPayloadBuilder;
    private final AiEnginePlanningClient aiEnginePlanningClient;
    private final ObjectMapper objectMapper;

    @Value("${wealth.planning.template-upload-directory:./planning-templates}")
    private String templateUploadDirectoryRaw;

    public Map<String, Object> buildComposedPayload(
            UUID caseId,
            UUID clientId,
            PlanTemplate template,
            Map<String, Object> assumptions,
            boolean markReadyForReview
    ) {
        discoveryProjectionService.rebuild(caseId);

        Map<String, Object> base = planPayloadBuilder.build(
                caseId,
                clientId,
                template,
                assumptions,
                markReadyForReview
        );

        Map<String, Object> composeRequest = new LinkedHashMap<>();
        composeRequest.put("template", templateMeta(template));
        composeRequest.put("discovery", base.get("discovery"));
        composeRequest.put("assumptions", base.get("assumptions"));
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("caseId", caseId.toString());
        context.put("clientId", clientId.toString());
        context.put("templateCode", base.get("templateCode"));
        context.put("templateVersion", base.get("templateVersion"));
        context.put("templateLocale", base.get("templateLocale"));
        context.put("generatedAt", base.get("generatedAt"));
        if (base.get("clientProfile") instanceof Map<?, ?> profile) {
            @SuppressWarnings("unchecked")
            Map<String, Object> clientProfile = new LinkedHashMap<>((Map<String, Object>) profile);
            context.put("clientProfile", clientProfile);
        }
        composeRequest.put("context", context);
        composeRequest.put(
                "mappingJson",
                template.getMappingJson() == null ? Map.of() : template.getMappingJson()
        );
        if (template.getStructureJson() != null && !template.getStructureJson().isEmpty()) {
            composeRequest.put("templateStructure", template.getStructureJson());
        }
        attachTemplateDocxForAnalysis(composeRequest, template);
        int mappingPlaceholders = 0;
        if (template.getMappingJson() != null) {
            Object placeholders = template.getMappingJson().get("placeholders");
            if (placeholders instanceof Map<?, ?> map) {
                mappingPlaceholders = map.size();
            }
        }
        log.info(
                "Planning compose start caseId={} clientId={} templateCode={} assumptions={} mappingPlaceholders={}",
                caseId,
                clientId,
                template.getCode(),
                assumptions == null ? 0 : assumptions.size(),
                mappingPlaceholders
        );

        try {
            JsonNode agent = aiEnginePlanningClient.composePlanningPayload(composeRequest);
            Map<String, Object> merged = mergeAgentOutput(base, agent);
            Map<?, ?> exportPlaceholders = merged.get("exportPlaceholders") instanceof Map<?, ?> m ? m : Map.of();
            Object planningAgent = merged.get("planningAgent");
            Object llmUsed = planningAgent instanceof Map<?, ?> m ? m.get("llmUsed") : null;
            Object llmProvider = planningAgent instanceof Map<?, ?> m ? m.get("llmProvider") : null;
            Object documentTemplate = merged.get("documentTemplate");
            int sectionCount = documentTemplate instanceof Map<?, ?> m && m.get("sections") instanceof List<?> s
                    ? s.size()
                    : 0;
            log.info(
                    "Planning compose success caseId={} llmUsed={} llmProvider={} exportPlaceholders={} documentSections={}",
                    caseId,
                    llmUsed,
                    llmProvider,
                    exportPlaceholders.size(),
                    sectionCount
            );
            return merged;
        } catch (RuntimeException ex) {
            log.warn("Planning agent compose failed for caseId={} templateCode={}", caseId, template.getCode(), ex);
            return base;
        }
    }

    private Map<String, Object> mergeAgentOutput(Map<String, Object> base, JsonNode agent) {
        if (agent == null || agent.isNull()) {
            return base;
        }
        Map<String, Object> merged = new LinkedHashMap<>(base);

        Map<String, Object> agentMap = objectMapper.convertValue(agent, new TypeReference<>() {});
        merged.put("planningAgent", agentMap);

        JsonNode narratives = agent.get("narratives");
        if (narratives != null && narratives.isObject()) {
            Map<String, Object> aiNarratives = new LinkedHashMap<>();
            putIfText(aiNarratives, "executiveSummary", narratives.get("executiveSummary"));
            putIfText(aiNarratives, "situationAnalysis", narratives.get("situationAnalysis"));
            putIfText(aiNarratives, "recommendations", narratives.get("recommendations"));
            putIfText(aiNarratives, "dataQualityNotes", narratives.get("dataQualityNotes"));
            putIfText(aiNarratives, "qualityGate", narratives.get("qualityGate"));
            merged.put("aiNarratives", aiNarratives);
        }

        JsonNode export = agent.get("exportPlaceholders");
        if (export != null && export.isObject()) {
            merged.put("exportPlaceholders", objectMapper.convertValue(export, new TypeReference<>() {}));
        }

        JsonNode keyMetrics = agent.get("keyMetrics");
        if (keyMetrics != null && keyMetrics.isObject()) {
            @SuppressWarnings("unchecked")
            Map<String, Object> existing = merged.get("keyMetrics") instanceof Map<?, ?> m
                    ? new LinkedHashMap<>((Map<String, Object>) m)
                    : new LinkedHashMap<>();
            keyMetrics.fields().forEachRemaining(e ->
                    existing.put(e.getKey(), objectMapper.convertValue(e.getValue(), Object.class)));
            merged.put("keyMetrics", existing);
        }

        mergeJsonObject(merged, agent, "templateAnalysis");
        mergeJsonObject(merged, agent, "documentTemplate");
        mergeJsonObject(merged, agent, "sectionContent");

        return merged;
    }

    private void mergeJsonObject(Map<String, Object> merged, JsonNode agent, String field) {
        JsonNode node = agent.get(field);
        if (node != null && node.isObject()) {
            merged.put(field, objectMapper.convertValue(node, new TypeReference<>() {}));
        }
    }

    private static void putIfText(Map<String, Object> target, String key, JsonNode node) {
        if (node != null && node.isTextual() && !node.asText().isBlank()) {
            target.put(key, node.asText());
        }
    }

    private void attachTemplateDocxForAnalysis(Map<String, Object> composeRequest, PlanTemplate template) {
        if (!needsTemplateStructureRefresh(template)) {
            return;
        }
        if (template.getDocument() == null || template.getDocument().getStorageKey() == null) {
            return;
        }
        try {
            Path base = Paths.get(templateUploadDirectoryRaw).toAbsolutePath().normalize();
            Path file = base.resolve(template.getDocument().getStorageKey()).normalize();
            if (!file.startsWith(base) || !Files.isRegularFile(file)) {
                log.warn("Template DOCX not found for compose re-analysis: {}", template.getCode());
                return;
            }
            byte[] bytes = Files.readAllBytes(file);
            composeRequest.put("templateBase64", Base64.getEncoder().encodeToString(bytes));
            log.info(
                    "Planning compose attached template DOCX for structure refresh templateCode={} bytes={}",
                    template.getCode(),
                    bytes.length
            );
        } catch (IOException ex) {
            log.warn("Failed to read template DOCX for compose: {}", template.getCode(), ex);
        }
    }

    private static boolean needsTemplateStructureRefresh(PlanTemplate template) {
        Map<String, Object> structure = template.getStructureJson();
        if (structure == null || structure.isEmpty()) {
            return true;
        }
        Object logical = structure.get("logicalSections");
        if (logical instanceof List<?> list && list.size() >= 3) {
            return false;
        }
        Object count = structure.get("logicalSectionCount");
        if (count instanceof Number number && number.intValue() >= 3) {
            return false;
        }
        return true;
    }

    private static Map<String, Object> templateMeta(PlanTemplate template) {
        Map<String, Object> meta = new LinkedHashMap<>();
        meta.put("id", template.getId().toString());
        meta.put("code", template.getCode());
        meta.put("name", template.getName());
        meta.put("versionNo", template.getVersionNo());
        meta.put("locale", template.getLocale());
        meta.put("productType", template.getProductType());
        meta.put("status", template.getStatus());
        return meta;
    }
}
