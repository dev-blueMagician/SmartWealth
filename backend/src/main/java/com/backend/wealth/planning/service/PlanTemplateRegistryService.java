package com.backend.wealth.planning.service;

import com.backend.wealth.cases.documents.model.StoredDocument;
import com.backend.wealth.cases.documents.repository.StoredDocumentRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.integration.AiEnginePlanningClient;
import com.backend.wealth.plan.repository.FinancialPlanRepository;
import com.backend.wealth.planning.dto.PlanTemplateResponse;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.extern.slf4j.Slf4j;
import com.backend.wealth.planning.model.PlanTemplate;
import com.backend.wealth.planning.repository.PlanTemplateRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PlanTemplateRegistryService {

    private static final long MAX_DOCX_BYTES = 25L * 1024 * 1024;
    private static final long MAX_MAPPING_BYTES = 8L * 1024 * 1024;

    private final PlanTemplateRepository planTemplateRepository;
    private final FinancialPlanRepository financialPlanRepository;
    private final StoredDocumentRepository storedDocumentRepository;
    private final AiEnginePlanningClient aiEnginePlanningClient;
    private final ObjectMapper objectMapper;

    @Value("${wealth.planning.template-upload-directory:./data/planning-templates}")
    private String templateUploadDirectoryRaw;

    @Transactional(readOnly = true)
    public List<PlanTemplateResponse> list() {
        return planTemplateRepository.findAllByOrderByUpdatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PlanTemplateResponse> listActive() {
        return planTemplateRepository.findAllByOrderByUpdatedAtDesc().stream()
                .filter(t -> "ACTIVE".equalsIgnoreCase(t.getStatus()))
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PlanTemplateResponse get(UUID templateId) {
        PlanTemplate template = planTemplateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Plan template not found: " + templateId));
        return toResponse(template);
    }

    @Transactional
    public PlanTemplateResponse upload(
            String code,
            String name,
            Integer versionNo,
            String locale,
            String productType,
            MultipartFile docxFile,
            MultipartFile mappingFile,
            Authentication authentication
    ) {
        if (docxFile == null || docxFile.isEmpty()) {
            throw new BusinessException("docxFile is required.");
        }
        if (docxFile.getSize() > MAX_DOCX_BYTES) {
            throw new BusinessException("DOCX file exceeds maximum allowed size.");
        }
        String docxName = docxFile.getOriginalFilename() == null ? "" : docxFile.getOriginalFilename();
        if (!docxName.toLowerCase().endsWith(".docx")) {
            throw new BusinessException("docxFile must be a .docx file.");
        }

        Map<String, Object> mapping = readMapping(mappingFile);
        String cleanedCode = requireNonBlank(code, "code");
        String cleanedName = requireNonBlank(name, "name");
        int safeVersion = versionNo == null || versionNo < 1 ? 1 : versionNo;
        String safeLocale = (locale == null || locale.isBlank()) ? "vi-VN" : locale.trim();

        StoredDocument doc = saveTemplateDocument(docxFile, authentication);
        PlanTemplate template = PlanTemplate.builder()
                .code(cleanedCode)
                .name(cleanedName)
                .versionNo(safeVersion)
                .status("DRAFT")
                .locale(safeLocale)
                .productType(trimOrNull(productType))
                .document(doc)
                .mappingJson(mapping)
                .build();
        planTemplateRepository.save(template);
        analyzeTemplateStructure(template);
        return toResponse(template);
    }

    @Transactional
    public PlanTemplateResponse publish(UUID templateId) {
        PlanTemplate template = planTemplateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Plan template not found: " + templateId));
        template.setStatus("ACTIVE");
        planTemplateRepository.save(template);
        return toResponse(template);
    }

    @Transactional
    public void delete(UUID templateId) {
        PlanTemplate template = planTemplateRepository.findById(templateId)
                .orElseThrow(() -> new NotFoundException("Plan template not found: " + templateId));
        if (financialPlanRepository.existsByTemplate_Id(templateId)) {
            throw new BusinessException("Cannot delete template that is used by planning drafts.");
        }

        StoredDocument document = template.getDocument();
        String storageKey = document == null ? null : document.getStorageKey();

        planTemplateRepository.delete(template);
        planTemplateRepository.flush();

        if (document != null) {
            storedDocumentRepository.delete(document);
        }
        deleteTemplateFileQuietly(storageKey);
    }

    private StoredDocument saveTemplateDocument(MultipartFile file, Authentication authentication) {
        String original = file.getOriginalFilename();
        if (original == null || original.isBlank()) {
            original = "template.docx";
        }
        if (original.length() > 500) {
            original = original.substring(0, 500);
        }
        String safe = sanitizeFilename(original);

        Path base = Paths.get(templateUploadDirectoryRaw).toAbsolutePath().normalize();
        try {
            Files.createDirectories(base);
        } catch (IOException ex) {
            throw new BusinessException("Cannot create template upload directory: " + ex.getMessage());
        }

        StoredDocument doc = StoredDocument.builder()
                .storageKey(null)
                .originalFilename(original)
                .contentType(file.getContentType())
                .byteSize(file.getSize())
                .uploadedBy(resolveUserId(authentication))
                .build();
        doc = storedDocumentRepository.saveAndFlush(doc);

        String relativeKey = "templates/" + doc.getId() + "_" + safe;
        Path target = base.resolve(relativeKey).normalize();
        if (!target.startsWith(base)) {
            throw new BusinessException("Invalid template upload path.");
        }
        try (InputStream in = file.getInputStream()) {
            Files.createDirectories(target.getParent());
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new BusinessException("Failed to store template file: " + ex.getMessage());
        }

        doc.setStorageKey(relativeKey);
        doc.setUpdatedAt(OffsetDateTime.now());
        return storedDocumentRepository.save(doc);
    }

    private void analyzeTemplateStructure(PlanTemplate template) {
        if (template.getDocument() == null || template.getDocument().getStorageKey() == null) {
            return;
        }
        try {
            Path file = resolveTemplateFile(template.getDocument().getStorageKey());
            byte[] bytes = Files.readAllBytes(file);
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("templateBase64", Base64.getEncoder().encodeToString(bytes));
            body.put("mappingJson", template.getMappingJson() == null ? Map.of() : template.getMappingJson());

            JsonNode result = aiEnginePlanningClient.analyzePlanningTemplate(body);
            if (result == null || result.isNull()) {
                log.warn("Template analyze returned empty for code={}", template.getCode());
                return;
            }
            JsonNode analysis = result.get("templateAnalysis");
            if (analysis != null && analysis.isObject()) {
                template.setStructureJson(objectMapper.convertValue(analysis, new TypeReference<>() {}));
            }
            JsonNode detected = result.get("placeholdersDetected");
            if (detected != null && detected.isArray()) {
                template.setPlaceholdersDetected(
                        objectMapper.convertValue(detected, new TypeReference<List<String>>() {}));
            } else if (detected != null && !detected.isNull()) {
                template.setPlaceholdersDetected(Collections.emptyList());
            }
            template.setAnalyzedAt(OffsetDateTime.now());
            planTemplateRepository.save(template);
            log.info(
                    "Template analyze stored code={} placeholders={}",
                    template.getCode(),
                    detected != null && detected.isArray() ? detected.size() : 0
            );
        } catch (RuntimeException ex) {
            log.warn("Template analyze failed for code={}: {}", template.getCode(), ex.getMessage());
        } catch (IOException ex) {
            log.warn("Template analyze IO failed for code={}: {}", template.getCode(), ex.getMessage());
        }
    }

    private Path resolveTemplateFile(String storageKey) throws IOException {
        Path base = Paths.get(templateUploadDirectoryRaw).toAbsolutePath().normalize();
        Path target = base.resolve(storageKey).normalize();
        if (!target.startsWith(base)) {
            throw new BusinessException("Invalid template storage key.");
        }
        if (!Files.isRegularFile(target)) {
            throw new IOException("Template file not found: " + storageKey);
        }
        return target;
    }

    private void deleteTemplateFileQuietly(String storageKey) {
        if (storageKey == null || storageKey.isBlank()) {
            return;
        }
        try {
            Path file = resolveTemplateFile(storageKey);
            Files.deleteIfExists(file);
        } catch (RuntimeException | IOException ex) {
            log.warn("Failed to delete template file {}: {}", storageKey, ex.getMessage());
        }
    }

    private Map<String, Object> readMapping(MultipartFile mappingFile) {
        if (mappingFile == null || mappingFile.isEmpty()) {
            return Map.of();
        }
        if (mappingFile.getSize() > MAX_MAPPING_BYTES) {
            throw new BusinessException("Mapping file exceeds maximum allowed size.");
        }
        String filename = mappingFile.getOriginalFilename() == null ? "" : mappingFile.getOriginalFilename().toLowerCase();
        if (!filename.endsWith(".json")) {
            throw new BusinessException("mappingFile currently supports .json only.");
        }
        try {
            String raw = new String(mappingFile.getBytes(), StandardCharsets.UTF_8);
            if (raw.isBlank()) {
                return Map.of();
            }
            return objectMapper.readValue(raw, new TypeReference<>() {
            });
        } catch (IOException ex) {
            throw new BusinessException("Failed to parse mappingFile JSON: " + ex.getMessage());
        }
    }

    private PlanTemplateResponse toResponse(PlanTemplate template) {
        return new PlanTemplateResponse(
                template.getId(),
                template.getCode(),
                template.getName(),
                template.getVersionNo(),
                template.getStatus(),
                template.getLocale(),
                template.getProductType(),
                template.getDocument().getId(),
                template.getDocument().getOriginalFilename(),
                template.getMappingJson(),
                template.getStructureJson(),
                template.getPlaceholdersDetected(),
                template.getAnalyzedAt(),
                template.getCreatedAt(),
                template.getUpdatedAt()
        );
    }

    private static String requireNonBlank(String value, String fieldName) {
        if (value == null || value.isBlank()) {
            throw new BusinessException(fieldName + " is required.");
        }
        return value.trim();
    }

    private static String trimOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }

    private static UUID resolveUserId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String sanitizeFilename(String name) {
        String cleaned = name.replace("\\", "_").replace("/", "_").replaceAll("[^a-zA-Z0-9._-]", "_");
        if (cleaned.isBlank()) {
            cleaned = "file";
        }
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }
}
