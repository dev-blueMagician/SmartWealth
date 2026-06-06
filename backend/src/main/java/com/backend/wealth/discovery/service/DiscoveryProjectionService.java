package com.backend.wealth.discovery.service;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.discovery.dto.CaseDiscoveryDatasetResponse;
import com.backend.wealth.discovery.dto.CaseDiscoveryFieldPageResponse;
import com.backend.wealth.discovery.dto.CaseDiscoveryFieldResponse;
import com.backend.wealth.discovery.dto.DiscoveryRebuildResponse;
import com.backend.wealth.discovery.dto.UnmappedDiscoveryAnswerResponse;
import com.backend.wealth.discovery.model.CaseDiscoveryField;
import com.backend.wealth.discovery.model.FieldDictionary;
import com.backend.wealth.discovery.model.QuestionAnswer;
import com.backend.wealth.discovery.model.QuestionFieldMapping;
import com.backend.wealth.discovery.repository.CaseDiscoveryFieldRepository;
import com.backend.wealth.discovery.repository.FieldDictionaryRepository;
import com.backend.wealth.discovery.repository.QuestionAnswerRepository;
import com.backend.wealth.discovery.repository.QuestionFieldMappingRepository;
import com.backend.wealth.discovery.support.AnswerValueSupport;
import com.backend.wealth.exception.NotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiscoveryProjectionService {

    private static final String STATUS_FILLED = "filled";
    private static final String STATUS_MISSING = "missing";
    private static final String SOURCE_QUESTIONNAIRE = "questionnaire";
    private static final String MANDATORY = "Mandatory";

    private final WealthCaseRepository wealthCaseRepository;
    private final QuestionAnswerRepository questionAnswerRepository;
    private final QuestionFieldMappingRepository questionFieldMappingRepository;
    private final FieldDictionaryRepository fieldDictionaryRepository;
    private final CaseDiscoveryFieldRepository caseDiscoveryFieldRepository;

    @Transactional
    public DiscoveryRebuildResponse rebuild(UUID caseId) {
        WealthCase wealthCase = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("case not found: " + caseId));

        List<String> warnings = new ArrayList<>();
        int unmappedAnswerCount = 0;

        caseDiscoveryFieldRepository.deleteByWealthCase_Id(caseId);

        List<QuestionAnswer> answers =
                questionAnswerRepository.findByWealthCase_IdOrderByQuestion_QuestionIdAscBlockIndexAsc(caseId);

        Map<String, ProjectedRow> projectedByField = new LinkedHashMap<>();

        for (QuestionAnswer answer : answers) {
            String questionId = answer.getQuestion().getQuestionId();
            List<QuestionFieldMapping> mappings = questionFieldMappingRepository.findByQuestion_QuestionId(questionId);
            JsonNode value = answer.getAnswerValue();
            boolean empty = AnswerValueSupport.isEmpty(value);

            if (mappings.isEmpty()) {
                if (!empty) {
                    unmappedAnswerCount++;
                    warnings.add("No mapping for " + questionId + " (block " + answer.getBlockIndex() + ")");
                }
                continue;
            }

            boolean anyValidMapping = false;
            for (QuestionFieldMapping mapping : mappings) {
                String systemField = mapping.getSystemField();
                if (!fieldDictionaryRepository.existsById(systemField)) {
                    if (!empty) {
                        warnings.add("Mapping " + questionId + " -> \"" + systemField
                                + "\" not in field_dictionary");
                    }
                    continue;
                }
                anyValidMapping = true;
                String status = empty ? STATUS_MISSING : STATUS_FILLED;
                projectedByField.put(systemField, new ProjectedRow(
                        systemField,
                        value,
                        AnswerValueSupport.toDisplayText(value),
                        status,
                        questionId,
                        answer.getBlockIndex(),
                        mapping.getId()
                ));
            }

            if (!empty && !anyValidMapping) {
                unmappedAnswerCount++;
            }
        }

        int filledCount = 0;
        int missingMaterialized = 0;
        for (ProjectedRow row : projectedByField.values()) {
            CaseDiscoveryField entity = CaseDiscoveryField.builder()
                    .wealthCase(wealthCase)
                    .systemField(row.systemField())
                    .valueJsonb(row.valueJsonb())
                    .valueText(row.valueText())
                    .source(SOURCE_QUESTIONNAIRE)
                    .status(row.status())
                    .questionId(row.questionId())
                    .blockIndex(row.blockIndex())
                    .mappingId(row.mappingId())
                    .build();
            caseDiscoveryFieldRepository.save(entity);
            if (STATUS_FILLED.equals(row.status())) {
                filledCount++;
            } else {
                missingMaterialized++;
            }
        }

        long mandatoryTotal = fieldDictionaryRepository.countByMandatoryLevel(MANDATORY);
        long mandatoryFilled = caseDiscoveryFieldRepository.countFilledMandatoryFields(caseId);
        long mandatoryMissing = caseDiscoveryFieldRepository.countMissingMandatoryFields(caseId);

        return new DiscoveryRebuildResponse(
                caseId,
                projectedByField.size(),
                filledCount,
                missingMaterialized,
                unmappedAnswerCount,
                mandatoryTotal,
                mandatoryFilled,
                mandatoryMissing,
                warnings.size() > 50 ? warnings.subList(0, 50) : warnings
        );
    }

    @Transactional(readOnly = true)
    public CaseDiscoveryFieldPageResponse listFields(
            UUID caseId,
            String status,
            int page,
            int size
    ) {
        requireCase(caseId);
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 500);
        Pageable pageable = PageRequest.of(safePage, safeSize);

        Page<CaseDiscoveryField> result = caseDiscoveryFieldRepository.findByCaseAndStatus(
                caseId,
                StringUtils.hasText(status) ? status.trim() : null,
                pageable
        );

        Map<String, FieldDictionary> dictByField = loadDictionaryForFields(
                result.getContent().stream().map(CaseDiscoveryField::getSystemField).toList()
        );

        List<CaseDiscoveryFieldResponse> items = result.getContent().stream()
                .map(row -> toFieldResponse(row, dictByField.get(row.getSystemField())))
                .toList();

        long mandatoryTotal = fieldDictionaryRepository.countByMandatoryLevel(MANDATORY);
        long mandatoryFilled = caseDiscoveryFieldRepository.countFilledMandatoryFields(caseId);
        long mandatoryMissing = caseDiscoveryFieldRepository.countMissingMandatoryFields(caseId);

        return new CaseDiscoveryFieldPageResponse(
                items,
                result.getTotalElements(),
                safePage,
                safeSize,
                mandatoryTotal,
                mandatoryFilled,
                mandatoryMissing
        );
    }

    @Transactional(readOnly = true)
    public CaseDiscoveryDatasetResponse getDataset(UUID caseId) {
        requireCase(caseId);
        List<CaseDiscoveryField> rows = caseDiscoveryFieldRepository
                .findByWealthCase_IdOrderBySystemFieldAsc(caseId, PageRequest.of(0, 10_000))
                .getContent();

        Map<String, FieldDictionary> dictByField = loadDictionaryForFields(
                rows.stream().map(CaseDiscoveryField::getSystemField).toList()
        );

        Map<String, CaseDiscoveryFieldResponse> fields = new LinkedHashMap<>();
        for (CaseDiscoveryField row : rows) {
            fields.put(row.getSystemField(), toFieldResponse(row, dictByField.get(row.getSystemField())));
        }

        List<UnmappedDiscoveryAnswerResponse> unmapped = collectUnmappedForSummary(caseId, 100);

        long mandatoryTotal = fieldDictionaryRepository.countByMandatoryLevel(MANDATORY);
        long mandatoryFilled = caseDiscoveryFieldRepository.countFilledMandatoryFields(caseId);
        long mandatoryMissing = caseDiscoveryFieldRepository.countMissingMandatoryFields(caseId);

        return new CaseDiscoveryDatasetResponse(
                caseId,
                fields,
                unmapped,
                mandatoryTotal,
                mandatoryFilled,
                mandatoryMissing
        );
    }

    @Transactional(readOnly = true)
    public List<UnmappedDiscoveryAnswerResponse> collectUnmappedForSummary(UUID caseId, int limit) {
        List<UnmappedDiscoveryAnswerResponse> unmapped = new ArrayList<>();
        List<QuestionAnswer> answers =
                questionAnswerRepository.findByWealthCase_IdOrderByQuestion_QuestionIdAscBlockIndexAsc(caseId);

        int safeLimit = Math.min(Math.max(limit, 0), 200);
        for (QuestionAnswer answer : answers) {
            if (unmapped.size() >= safeLimit) {
                break;
            }
            if (AnswerValueSupport.isEmpty(answer.getAnswerValue())) {
                continue;
            }
            String questionId = answer.getQuestion().getQuestionId();
            List<QuestionFieldMapping> mappings = questionFieldMappingRepository.findByQuestion_QuestionId(questionId);
            boolean hasValid = mappings.stream()
                    .anyMatch(m -> fieldDictionaryRepository.existsById(m.getSystemField()));
            if (!hasValid) {
                String mappingField = mappings.isEmpty() ? null : mappings.get(0).getSystemField();
                unmapped.add(new UnmappedDiscoveryAnswerResponse(
                        questionId,
                        answer.getBlockIndex(),
                        answer.getAnswerValue(),
                        mappingField
                ));
            }
        }
        return unmapped;
    }

    private Map<String, FieldDictionary> loadDictionaryForFields(List<String> systemFields) {
        if (systemFields.isEmpty()) {
            return Map.of();
        }
        return fieldDictionaryRepository.findAllById(systemFields).stream()
                .collect(Collectors.toMap(FieldDictionary::getSystemFieldName, f -> f, (a, b) -> a));
    }

    private CaseDiscoveryFieldResponse toFieldResponse(CaseDiscoveryField row, FieldDictionary dict) {
        return new CaseDiscoveryFieldResponse(
                row.getId(),
                row.getWealthCase().getId(),
                row.getSystemField(),
                row.getValueJsonb(),
                row.getValueText(),
                row.getSource(),
                row.getStatus(),
                row.getQuestionId(),
                row.getBlockIndex(),
                row.getMappingId(),
                dict != null ? dict.getDataDomain() : null,
                dict != null ? dict.getDataItem() : null,
                dict != null ? dict.getDetailFieldName() : null,
                dict != null ? dict.getMandatoryLevel() : null,
                dict != null ? dict.getDataType() : null,
                row.getUpdatedAt()
        );
    }

    private void requireCase(UUID caseId) {
        if (!wealthCaseRepository.existsById(caseId)) {
            throw new NotFoundException("case not found: " + caseId);
        }
    }

    private record ProjectedRow(
            String systemField,
            JsonNode valueJsonb,
            String valueText,
            String status,
            String questionId,
            int blockIndex,
            UUID mappingId
    ) {
    }
}
