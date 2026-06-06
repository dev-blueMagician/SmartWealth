package com.backend.wealth.planning.service;

import com.backend.wealth.cases.documents.model.StoredDocument;
import com.backend.wealth.cases.documents.repository.StoredDocumentRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.integration.AiEnginePlanningClient;
import com.backend.wealth.plan.model.FinancialPlan;
import com.backend.wealth.plan.repository.FinancialPlanRepository;
import com.backend.wealth.planning.dto.ExportPlanningDraftRequest;
import com.backend.wealth.planning.dto.PlanningExportResponse;
import com.backend.wealth.planning.model.PlanArtifact;
import com.backend.wealth.planning.model.PlanTemplate;
import com.backend.wealth.planning.repository.PlanArtifactRepository;
import com.backend.wealth.planning.repository.PlanTemplateRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFHeader;
import org.apache.poi.xwpf.usermodel.XWPFFooter;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.apache.poi.xwpf.usermodel.XWPFTable;
import org.apache.poi.xwpf.usermodel.XWPFTableCell;
import org.apache.poi.xwpf.usermodel.XWPFTableRow;
import org.openxmlformats.schemas.wordprocessingml.x2006.main.CTP;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanDocxExportService {

    public static final String ARTIFACT_KIND_EXPORT_DOCX = "EXPORT_DOCX";

    private final FinancialPlanRepository financialPlanRepository;
    private final PlanTemplateRepository planTemplateRepository;
    private final PlanArtifactRepository planArtifactRepository;
    private final StoredDocumentRepository storedDocumentRepository;
    private final AiEnginePlanningClient aiEnginePlanningClient;
    private final PlanningAgentComposeService planningAgentComposeService;

    @Value("${wealth.planning.template-upload-directory:./data/planning-templates}")
    private String templateUploadDirectoryRaw;

    @Value("${wealth.planning.artifact-export-directory:./data/planning-artifacts}")
    private String artifactExportDirectoryRaw;

    @Transactional
    public PlanningExportResponse exportDocx(UUID planId, ExportPlanningDraftRequest request) {
        FinancialPlan plan = financialPlanRepository.findById(planId)
                .orElseThrow(() -> new NotFoundException("Plan draft not found: " + planId));

        UUID templateId = request != null && request.templateId() != null
                ? request.templateId()
                : (plan.getTemplate() != null ? plan.getTemplate().getId() : null);
        if (templateId == null) {
            throw new BusinessException("templateId is required when plan has no linked template.");
        }

        PlanTemplate template = planTemplateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Plan template not found: " + templateId));
        if (!"ACTIVE".equalsIgnoreCase(template.getStatus())) {
            throw new BusinessException("Template must be ACTIVE to export: " + template.getCode());
        }

        Map<String, Object> content = refreshContentForExport(plan, template, request);
        if (content == null || content.isEmpty()) {
            throw new BusinessException("Plan draft has no content to export.");
        }

        Path templateFile = resolveStoredFile(template.getDocument().getStorageKey());
        Map<String, String> replacements = buildReplacements(content, template.getMappingJson());
        Map<String, Object> narratives = extractNarratives(content);
        Map<String, Object> documentTemplate = extractMap(content, "documentTemplate");
        Map<String, String> sectionContent = extractSectionContent(content);
        log.info(
                "Planning export start planId={} templateId={} templateCode={} replacements={} narratives={} "
                        + "sectionContent={} llmUsed={}",
                planId,
                templateId,
                template.getCode(),
                replacements.size(),
                narratives.size(),
                sectionContent.size(),
                readLlmUsed(content)
        );

        String exportMode = resolveExportMode(request, sectionContent);
        String exportName = "llm_only".equals(exportMode)
                ? "plan_" + planId + "_AI_" + template.getCode() + ".docx"
                : "plan_" + planId + "_" + template.getCode() + "_v" + template.getVersionNo() + ".docx";
        StoredDocument exported = renderAndStoreDocx(
                templateFile,
                replacements,
                narratives,
                documentTemplate,
                sectionContent,
                exportMode,
                template.getName(),
                exportName
        );
        log.info(
                "Planning export done planId={} documentId={} byteSize={}",
                planId,
                exported.getId(),
                exported.getByteSize()
        );

        PlanArtifact artifact = PlanArtifact.builder()
                .plan(plan)
                .document(exported)
                .artifactKind(ARTIFACT_KIND_EXPORT_DOCX)
                .build();
        artifact = planArtifactRepository.save(artifact);

        return new PlanningExportResponse(
                artifact.getId(),
                exported.getId(),
                exported.getOriginalFilename(),
                "/planning/artifacts/" + artifact.getId() + "/download"
        );
    }

    @Transactional(readOnly = true)
    public StoredDocument resolveArtifactDocument(UUID artifactId) {
        PlanArtifact artifact = planArtifactRepository.findById(artifactId)
                .orElseThrow(() -> new NotFoundException("Plan artifact not found: " + artifactId));
        return artifact.getDocument();
    }

    @Transactional(readOnly = true)
    public Path resolveArtifactFilePath(UUID artifactId) {
        StoredDocument doc = resolveArtifactDocument(artifactId);
        if (doc.getStorageKey() == null || doc.getStorageKey().isBlank()) {
            throw new BusinessException("Artifact document has no storage key.");
        }
        return resolveStoredFile(doc.getStorageKey());
    }

    private Map<String, Object> refreshContentForExport(
            FinancialPlan plan,
            PlanTemplate template,
            ExportPlanningDraftRequest request
    ) {
        boolean refresh = request == null || request.refreshCompose() == null || request.refreshCompose();
        Map<String, Object> existing = plan.getContent();
        if (!refresh) {
            return existing == null ? Map.of() : existing;
        }
        UUID caseId = extractCaseIdFromContent(existing);
        if (caseId == null) {
            log.warn("Planning export refresh skipped: plan content missing caseId planId={}", plan.getId());
            return existing == null ? Map.of() : existing;
        }
        Map<String, Object> assumptions = extractMap(existing, "assumptions");
        Map<String, Object> refreshed = planningAgentComposeService.buildComposedPayload(
                caseId,
                plan.getClient().getId(),
                template,
                assumptions,
                false
        );
        plan.setContent(refreshed);
        financialPlanRepository.save(plan);
        return refreshed;
    }

    private StoredDocument renderAndStoreDocx(
            Path templateFile,
            Map<String, String> replacements,
            Map<String, Object> narratives,
            Map<String, Object> documentTemplate,
            Map<String, String> sectionContent,
            String exportMode,
            String documentTitle,
            String exportName
    ) {
        try {
            Map<String, Object> renderBody = new LinkedHashMap<>();
            renderBody.put("placeholders", replacements);
            renderBody.put("narratives", narratives);
            renderBody.put("documentTemplate", documentTemplate);
            renderBody.put("sectionContent", sectionContent);
            renderBody.put("exportMode", exportMode);
            renderBody.put("appendSummary", true);
            renderBody.put("appendDocumentSections", false);
            if (documentTitle != null && !documentTitle.isBlank()) {
                renderBody.put("documentTitle", documentTitle);
            }
            if (!"llm_only".equals(exportMode)) {
                byte[] templateBytes = Files.readAllBytes(templateFile);
                renderBody.put("templateBase64", Base64.getEncoder().encodeToString(templateBytes));
                log.info(
                        "Planning export render-docx merge_template templateBytes={} placeholders={}",
                        templateBytes.length,
                        replacements.size()
                );
            } else {
                renderBody.put("templateBase64", "");
                log.info(
                        "Planning export render-docx llm_only placeholders={} sectionContent={}",
                        replacements.size(),
                        sectionContent.size()
                );
            }
            byte[] docxBytes = aiEnginePlanningClient.renderPlanningDocx(renderBody);
            log.info("Planning export render-docx success mode={} bytes={}", exportMode, docxBytes.length);
            return storeDocxBytes(docxBytes, exportName);
        } catch (IOException ex) {
            throw new BusinessException("Cannot read template DOCX: " + ex.getMessage());
        } catch (RuntimeException ex) {
            log.warn("AI-engine DOCX render failed, using local POI fallback mode={}", exportMode, ex);
            return storeFilledDocxLocal(
                    templateFile,
                    replacements,
                    narratives,
                    documentTemplate,
                    sectionContent,
                    exportMode,
                    documentTitle,
                    exportName
            );
        }
    }

    private static String resolveExportMode(ExportPlanningDraftRequest request, Map<String, String> sectionContent) {
        if (request != null && request.exportMode() != null && !request.exportMode().isBlank()) {
            return request.exportMode().trim().toLowerCase(java.util.Locale.ROOT);
        }
        return sectionContent == null || sectionContent.isEmpty() ? "merge_template" : "llm_only";
    }

    private StoredDocument storeDocxBytes(byte[] docxBytes, String exportName) {
        Path base = Paths.get(artifactExportDirectoryRaw).toAbsolutePath().normalize();
        try {
            Files.createDirectories(base);
        } catch (IOException ex) {
            throw new BusinessException("Cannot create artifact export directory: " + ex.getMessage());
        }

        StoredDocument doc = StoredDocument.builder()
                .storageKey(null)
                .originalFilename(exportName)
                .contentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                .byteSize((long) docxBytes.length)
                .build();
        doc = storedDocumentRepository.saveAndFlush(doc);

        String relativeKey = "exports/" + doc.getId() + "_" + sanitizeFilename(exportName);
        Path target = base.resolve(relativeKey).normalize();
        if (!target.startsWith(base)) {
            throw new BusinessException("Invalid artifact export path.");
        }
        try {
            Files.createDirectories(target.getParent());
            Files.write(target, docxBytes);
        } catch (IOException ex) {
            throw new BusinessException("Failed to store exported DOCX: " + ex.getMessage());
        }

        doc.setStorageKey(relativeKey);
        doc.setUpdatedAt(OffsetDateTime.now());
        return storedDocumentRepository.save(doc);
    }

    private StoredDocument storeFilledDocxLocal(
            Path templateFile,
            Map<String, String> replacements,
            Map<String, Object> narratives,
            Map<String, Object> documentTemplate,
            Map<String, String> sectionContent,
            String exportMode,
            String documentTitle,
            String exportName
    ) {
        if ("llm_only".equals(exportMode)) {
            return storeLlmOnlyDocxLocal(
                    replacements,
                    narratives,
                    documentTemplate,
                    sectionContent,
                    documentTitle,
                    exportName
            );
        }
        Path base = Paths.get(artifactExportDirectoryRaw).toAbsolutePath().normalize();
        try {
            Files.createDirectories(base);
        } catch (IOException ex) {
            throw new BusinessException("Cannot create artifact export directory: " + ex.getMessage());
        }

        StoredDocument doc = StoredDocument.builder()
                .storageKey(null)
                .originalFilename(exportName)
                .contentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                .byteSize(null)
                .build();
        doc = storedDocumentRepository.saveAndFlush(doc);

        String relativeKey = "exports/" + doc.getId() + "_" + sanitizeFilename(exportName);
        Path target = base.resolve(relativeKey).normalize();
        if (!target.startsWith(base)) {
            throw new BusinessException("Invalid artifact export path.");
        }

        try {
            Files.createDirectories(target.getParent());
        } catch (IOException ex) {
            throw new BusinessException("Cannot create artifact export subdirectory: " + ex.getMessage());
        }

        try (InputStream in = Files.newInputStream(templateFile);
             XWPFDocument document = new XWPFDocument(in);
             OutputStream out = Files.newOutputStream(target)) {
            applyReplacements(document, replacements);
            if (!sectionContent.isEmpty()) {
                appendAiSummarySection(document, narratives);
            }
            document.write(out);
            doc.setByteSize(Files.size(target));
        } catch (IOException ex) {
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
                // best-effort cleanup after failed export
            }
            throw new BusinessException(
                    "Failed to generate DOCX export from template: " + ex.getClass().getSimpleName() + ": " + ex.getMessage());
        }

        doc.setStorageKey(relativeKey);
        doc.setUpdatedAt(OffsetDateTime.now());
        return storedDocumentRepository.save(doc);
    }

    private Path resolveStoredFile(String storageKey) {
        Path base = Paths.get(templateUploadDirectoryRaw).toAbsolutePath().normalize();
        Path artifactBase = Paths.get(artifactExportDirectoryRaw).toAbsolutePath().normalize();
        Path target;
        if (storageKey.startsWith("exports/")) {
            target = artifactBase.resolve(storageKey).normalize();
            if (!target.startsWith(artifactBase)) {
                throw new BusinessException("Invalid artifact storage key.");
            }
        } else {
            target = base.resolve(storageKey).normalize();
            if (!target.startsWith(base)) {
                throw new BusinessException("Invalid template storage key.");
            }
        }
        if (!Files.isRegularFile(target)) {
            throw new BusinessException("Document file not found on disk: " + storageKey);
        }
        return target;
    }

    @SuppressWarnings("unchecked")
    static Map<String, String> buildReplacements(Map<String, Object> content, Map<String, Object> mappingJson) {
        Map<String, String> out = new LinkedHashMap<>();

        Object exportRaw = content.get("exportPlaceholders");
        if (exportRaw instanceof Map<?, ?> exportMap) {
            exportMap.forEach((k, v) -> {
                if (k != null && v != null) {
                    String key = normalizePlaceholder(k.toString());
                    out.put(key, v.toString());
                }
            });
        }

        Map<String, String> configured = extractConfiguredPlaceholders(mappingJson);
        for (Map.Entry<String, String> e : configured.entrySet()) {
            String value = resolveDotPath(content, e.getValue());
            if (value != null) {
                out.put(normalizePlaceholder(e.getKey()), value);
            }
        }

        out.putIfAbsent(normalizePlaceholder("{{CLIENT_ID}}"), stringOrEmpty(content.get("clientId")));
        out.putIfAbsent(normalizePlaceholder("{{CASE_ID}}"), stringOrEmpty(content.get("caseId")));
        out.putIfAbsent(normalizePlaceholder("{{TEMPLATE_CODE}}"), stringOrEmpty(content.get("templateCode")));
        out.putIfAbsent(normalizePlaceholder("{{GENERATED_AT}}"), stringOrEmpty(content.get("generatedAt")));

        Object ai = content.get("aiNarratives");
        if (ai instanceof Map<?, ?> narratives) {
            putDefaultNarrative(out, "{{EXECUTIVE_SUMMARY}}", narratives.get("executiveSummary"));
            putDefaultNarrative(out, "{{TOM_LUOC}}", narratives.get("executiveSummary"));
            putDefaultNarrative(out, "{{TOM_TAT}}", narratives.get("executiveSummary"));
            putDefaultNarrative(out, "{{SITUATION_ANALYSIS}}", narratives.get("situationAnalysis"));
            putDefaultNarrative(out, "{{RECOMMENDATIONS}}", narratives.get("recommendations"));
            putDefaultNarrative(out, "{{DATA_QUALITY}}", narratives.get("dataQualityNotes"));
        }

        Object agent = content.get("planningAgent");
        if (agent instanceof Map<?, ?> agentMap) {
            Object agentExport = agentMap.get("exportPlaceholders");
            if (agentExport instanceof Map<?, ?> agentPlaceholders) {
                agentPlaceholders.forEach((k, v) -> {
                    if (k != null && v != null && !v.toString().isBlank()) {
                        out.put(normalizePlaceholder(k.toString()), v.toString());
                    }
                });
            }
        }

        Map<String, String> sectionContent = extractSectionContent(content);
        Map<String, Object> documentTemplate = extractMap(content, "documentTemplate");
        applySectionContentToReplacements(out, documentTemplate, sectionContent);

        return out;
    }

    private static void applySectionContentToReplacements(
            Map<String, String> out,
            Map<String, Object> documentTemplate,
            Map<String, String> sectionContent
    ) {
        if (sectionContent.isEmpty()) {
            return;
        }
        Object rawSections = documentTemplate.get("sections");
        if (rawSections instanceof List<?> list) {
            for (Object item : list) {
                if (!(item instanceof Map<?, ?> section)) {
                    continue;
                }
                Object include = section.get("include");
                if (Boolean.FALSE.equals(include)) {
                    continue;
                }
                String sectionId = stringOrEmpty(section.get("id"));
                String body = sectionContent.get(sectionId);
                if (sectionId.isBlank() || body == null || body.isBlank()) {
                    continue;
                }
                Object placeholders = section.get("placeholders");
                if (placeholders instanceof List<?> tags) {
                    for (Object tag : tags) {
                        if (tag != null) {
                            out.put(normalizePlaceholder(tag.toString()), body);
                        }
                    }
                }
            }
        }
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> extractNarratives(Map<String, Object> content) {
        Map<String, Object> narratives = new LinkedHashMap<>();
        mergeInto(narratives, content.get("aiNarratives"));
        mergeInto(narratives, content.get("narratives"));
        Object agent = content.get("planningAgent");
        if (agent instanceof Map<?, ?> agentMap) {
            mergeInto(narratives, agentMap.get("narratives"));
        }
        return narratives;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> extractSectionContent(Map<String, Object> content) {
        Map<String, String> sections = new LinkedHashMap<>();
        Object raw = content.get("sectionContent");
        if (raw instanceof Map<?, ?> map) {
            map.forEach((k, v) -> {
                if (k != null && v != null && !v.toString().isBlank()) {
                    sections.put(k.toString(), v.toString());
                }
            });
        }
        return sections;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> extractMap(Map<String, Object> content, String key) {
        if (content == null || key == null) {
            return Map.of();
        }
        Object raw = content.get(key);
        if (!(raw instanceof Map<?, ?> map)) {
            return Map.of();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        map.forEach((k, v) -> {
            if (k != null && v != null) {
                out.put(k.toString(), v);
            }
        });
        return out;
    }

    private static void mergeInto(Map<String, Object> target, Object raw) {
        if (!(raw instanceof Map<?, ?> map)) {
            return;
        }
        map.forEach((k, v) -> {
            if (k != null && v != null && !v.toString().isBlank()) {
                target.putIfAbsent(k.toString(), v);
            }
        });
    }

    private static boolean readLlmUsed(Map<String, Object> content) {
        Object agent = content.get("planningAgent");
        if (agent instanceof Map<?, ?> map) {
            Object used = map.get("llmUsed");
            if (used instanceof Boolean b) {
                return b;
            }
        }
        return false;
    }

    private static UUID extractCaseIdFromContent(Map<String, Object> content) {
        if (content == null) {
            return null;
        }
        Object raw = content.get("caseId");
        if (!(raw instanceof String text) || text.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private StoredDocument storeLlmOnlyDocxLocal(
            Map<String, String> replacements,
            Map<String, Object> narratives,
            Map<String, Object> documentTemplate,
            Map<String, String> sectionContent,
            String documentTitle,
            String exportName
    ) {
        Path base = Paths.get(artifactExportDirectoryRaw).toAbsolutePath().normalize();
        try {
            Files.createDirectories(base);
        } catch (IOException ex) {
            throw new BusinessException("Cannot create artifact export directory: " + ex.getMessage());
        }

        StoredDocument doc = StoredDocument.builder()
                .storageKey(null)
                .originalFilename(exportName)
                .contentType("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
                .byteSize(null)
                .build();
        doc = storedDocumentRepository.saveAndFlush(doc);

        String relativeKey = "exports/" + doc.getId() + "_" + sanitizeFilename(exportName);
        Path target = base.resolve(relativeKey).normalize();
        if (!target.startsWith(base)) {
            throw new BusinessException("Invalid artifact export path.");
        }
        try {
            Files.createDirectories(target.getParent());
        } catch (IOException ex) {
            throw new BusinessException("Cannot create artifact export subdirectory: " + ex.getMessage());
        }

        try (XWPFDocument document = new XWPFDocument();
             OutputStream out = Files.newOutputStream(target)) {
            String title = documentTitle == null || documentTitle.isBlank()
                    ? "Kế hoạch tài chính"
                    : documentTitle;
            XWPFParagraph titleParagraph = document.createParagraph();
            XWPFRun titleRun = titleParagraph.createRun();
            titleRun.setBold(true);
            titleRun.setFontSize(16);
            titleRun.setText(title);
            appendMetadataLinesLocal(document, replacements);
            if (!sectionContent.isEmpty()) {
                appendDocumentSectionsLocal(document, documentTemplate, sectionContent, false);
            } else {
                appendAiSummarySection(document, narratives);
            }
            document.write(out);
            doc.setByteSize(Files.size(target));
        } catch (IOException ex) {
            throw new BusinessException("Failed to generate LLM-only DOCX: " + ex.getMessage());
        }

        doc.setStorageKey(relativeKey);
        doc.setUpdatedAt(OffsetDateTime.now());
        return storedDocumentRepository.save(doc);
    }

    private static void appendMetadataLinesLocal(XWPFDocument document, Map<String, String> replacements) {
        appendMetadataLine(document, replacements, "{{CLIENT_ID}}", "Mã khách hàng");
        appendMetadataLine(document, replacements, "{{CASE_ID}}", "Mã case");
        appendMetadataLine(document, replacements, "{{TEMPLATE_CODE}}", "Mẫu kế hoạch");
        appendMetadataLine(document, replacements, "{{GENERATED_AT}}", "Ngày lập");
    }

    private static void appendMetadataLine(
            XWPFDocument document,
            Map<String, String> replacements,
            String key,
            String label
    ) {
        String value = replacements.get(key);
        if (value == null || value.isBlank()) {
            return;
        }
        XWPFParagraph paragraph = document.createParagraph();
        paragraph.createRun().setText(label + ": " + value);
    }

    private static void appendDocumentSectionsLocal(
            XWPFDocument document,
            Map<String, Object> documentTemplate,
            Map<String, String> sectionContent,
            boolean pageBreakBefore
    ) {
        if (sectionContent == null || sectionContent.isEmpty()) {
            return;
        }
        List<Map<String, Object>> sections = new ArrayList<>();
        Object rawSections = documentTemplate.get("sections");
        if (rawSections instanceof List<?> list) {
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    Map<String, Object> section = new LinkedHashMap<>();
                    map.forEach((k, v) -> {
                        if (k != null && v != null) {
                            section.put(k.toString(), v);
                        }
                    });
                    sections.add(section);
                }
            }
        }
        if (sections.isEmpty()) {
            sectionContent.forEach((id, body) -> {
                Map<String, Object> section = new LinkedHashMap<>();
                section.put("id", id);
                section.put("title", id);
                section.put("include", true);
                sections.add(section);
            });
        }

        if (pageBreakBefore) {
            document.createParagraph().createRun().addBreak();
        }

        for (Map<String, Object> section : sections) {
            if (Boolean.FALSE.equals(section.get("include"))) {
                continue;
            }
            String sectionId = stringOrEmpty(section.get("id"));
            if (sectionId.isBlank()) {
                continue;
            }
            String body = sectionContent.get(sectionId);
            if (body == null || body.isBlank()) {
                continue;
            }
            String heading = stringOrEmpty(section.get("title"));
            if (heading.isBlank()) {
                heading = sectionId;
            }
            appendSummaryBlock(document, heading, body);
        }
    }

    private static void appendAiSummarySection(XWPFDocument document, Map<String, Object> narratives) {
        if (narratives == null || narratives.isEmpty()) {
            return;
        }
        String executiveSummary = stringOrEmpty(narratives.get("executiveSummary"));
        String situation = stringOrEmpty(narratives.get("situationAnalysis"));
        String recommendations = stringOrEmpty(narratives.get("recommendations"));
        String dataQuality = stringOrEmpty(narratives.get("dataQualityNotes"));
        if (executiveSummary.isBlank() && situation.isBlank() && recommendations.isBlank() && dataQuality.isBlank()) {
            return;
        }

        document.createParagraph().createRun().addBreak();
        XWPFParagraph title = document.createParagraph();
        XWPFRun titleRun = title.createRun();
        titleRun.setBold(true);
        titleRun.setFontSize(16);
        titleRun.setText("Tóm tắt kế hoạch (AI)");

        appendSummaryBlock(document, "Tóm lược điều hành", executiveSummary);
        appendSummaryBlock(document, "Phân tích hiện trạng", situation);
        appendSummaryBlock(document, "Khuyến nghị", recommendations);
        appendSummaryBlock(document, "Ghi chú chất lượng dữ liệu", dataQuality);
    }

    private static void appendSummaryBlock(XWPFDocument document, String heading, String body) {
        if (body == null || body.isBlank()) {
            return;
        }
        XWPFParagraph headingParagraph = document.createParagraph();
        XWPFRun headingRun = headingParagraph.createRun();
        headingRun.setBold(true);
        headingRun.setText(heading);

        for (String block : body.split("\\n\\s*\\n")) {
            String line = block.trim();
            if (line.isEmpty()) {
                continue;
            }
            XWPFParagraph paragraph = document.createParagraph();
            paragraph.createRun().setText(line);
        }
    }

    private static void putDefaultNarrative(Map<String, String> out, String tag, Object value) {
        if (value == null) {
            return;
        }
        String text = value.toString();
        if (text.isBlank()) {
            return;
        }
        out.putIfAbsent(normalizePlaceholder(tag), text);
    }

    @SuppressWarnings("unchecked")
    private static Map<String, String> extractConfiguredPlaceholders(Map<String, Object> mappingJson) {
        if (mappingJson == null || mappingJson.isEmpty()) {
            return Map.of();
        }
        Object placeholders = mappingJson.get("placeholders");
        if (!(placeholders instanceof Map<?, ?> map)) {
            return Map.of();
        }
        Map<String, String> result = new LinkedHashMap<>();
        map.forEach((k, v) -> {
            if (k != null && v != null) {
                result.put(k.toString(), v.toString());
            }
        });
        return result;
    }

    @SuppressWarnings("unchecked")
    static String resolveDotPath(Map<String, Object> root, String path) {
        if (path == null || path.isBlank()) {
            return null;
        }
        Object current = root;
        for (String segment : path.split("\\.")) {
            if (current == null) {
                return null;
            }
            if (current instanceof Map<?, ?> map) {
                current = map.get(segment);
            } else {
                return null;
            }
        }
        if (current == null) {
            return null;
        }
        return current.toString();
    }

    private static String stringOrEmpty(Object value) {
        return value == null ? "" : value.toString();
    }

    static String normalizePlaceholder(String key) {
        String trimmed = key == null ? "" : key.trim();
        if (trimmed.isEmpty()) {
            return trimmed;
        }
        if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
            return trimmed;
        }
        if (trimmed.startsWith("{{")) {
            return trimmed + "}}";
        }
        if (trimmed.endsWith("}}")) {
            return "{{" + trimmed;
        }
        return "{{" + trimmed + "}}";
    }

    private static void applyReplacements(XWPFDocument document, Map<String, String> replacements) {
        for (XWPFParagraph paragraph : document.getParagraphs()) {
            replaceInParagraph(paragraph, replacements);
        }
        for (XWPFTable table : document.getTables()) {
            for (XWPFTableRow row : table.getRows()) {
                for (XWPFTableCell cell : row.getTableCells()) {
                    for (XWPFParagraph paragraph : cell.getParagraphs()) {
                        replaceInParagraph(paragraph, replacements);
                    }
                }
            }
        }
        for (XWPFHeader header : document.getHeaderList()) {
            for (XWPFParagraph paragraph : header.getParagraphs()) {
                replaceInParagraph(paragraph, replacements);
            }
        }
        for (XWPFFooter footer : document.getFooterList()) {
            for (XWPFParagraph paragraph : footer.getParagraphs()) {
                replaceInParagraph(paragraph, replacements);
            }
        }
    }

    private static void replaceInParagraph(XWPFParagraph paragraph, Map<String, String> replacements) {
        String text = paragraph.getText();
        if (text == null || text.isBlank()) {
            return;
        }
        String updated = text;
        for (Map.Entry<String, String> entry : replacements.entrySet()) {
            if (updated.contains(entry.getKey())) {
                updated = updated.replace(entry.getKey(), entry.getValue());
            }
        }
        if (updated.equals(text)) {
            return;
        }
        List<XWPFRun> runs = paragraph.getRuns();
        if (runs != null && !runs.isEmpty()) {
            runs.getFirst().setText(updated, 0);
            for (int i = 1; i < runs.size(); i++) {
                runs.get(i).setText("", 0);
            }
            return;
        }
        CTP ctp = paragraph.getCTP();
        if (ctp != null) {
            paragraph.createRun().setText(updated);
        }
    }

    private static String sanitizeFilename(String name) {
        String cleaned = name.replace("\\", "_").replace("/", "_").replaceAll("[^a-zA-Z0-9._-]", "_");
        if (cleaned.isBlank()) {
            cleaned = "export.docx";
        }
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }
}
