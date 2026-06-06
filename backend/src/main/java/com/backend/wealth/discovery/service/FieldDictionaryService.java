package com.backend.wealth.discovery.service;

import com.backend.wealth.discovery.dto.CreateFieldDictionaryRequest;
import com.backend.wealth.discovery.dto.FieldDictionaryPageResponse;
import com.backend.wealth.discovery.dto.FieldDictionaryResponse;
import com.backend.wealth.discovery.dto.UpdateFieldDictionaryRequest;
import com.backend.wealth.discovery.model.FieldDictionary;
import com.backend.wealth.discovery.repository.CaseDiscoveryFieldRepository;
import com.backend.wealth.discovery.repository.FieldDictionaryRepository;
import com.backend.wealth.discovery.repository.QuestionFieldMappingRepository;
import com.backend.wealth.discovery.support.FieldDictionaryCsvRowMapper;
import com.backend.wealth.discovery.support.FieldDictionaryQueryParams;
import com.backend.wealth.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
@RequiredArgsConstructor
public class FieldDictionaryService {

    private final FieldDictionaryRepository fieldDictionaryRepository;
    private final CaseDiscoveryFieldRepository caseDiscoveryFieldRepository;
    private final QuestionFieldMappingRepository questionFieldMappingRepository;

    @Transactional(readOnly = true)
    public FieldDictionaryPageResponse list(
            String dataDomain,
            String mandatoryLevel,
            String search,
            int page,
            int size
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 500);
        Pageable pageable = PageRequest.of(safePage, safeSize);

        Page<FieldDictionary> result = fieldDictionaryRepository.search(
                FieldDictionaryQueryParams.likePattern(dataDomain),
                FieldDictionaryQueryParams.equalsNormalized(mandatoryLevel),
                FieldDictionaryQueryParams.likePattern(search),
                pageable
        );

        return new FieldDictionaryPageResponse(
                result.getContent().stream().map(FieldDictionaryService::toResponse).toList(),
                result.getTotalElements(),
                safePage,
                safeSize
        );
    }

    @Transactional(readOnly = true)
    public long count() {
        return fieldDictionaryRepository.count();
    }

    @Transactional(readOnly = true)
    public FieldDictionaryResponse get(String systemFieldName) {
        FieldDictionary entity = requireField(systemFieldName);
        return toResponse(entity);
    }

    @Transactional
    public FieldDictionaryResponse create(CreateFieldDictionaryRequest req) {
        String key = truncate(req.systemFieldName(), 200);
        if (!StringUtils.hasText(key)) {
            throw new IllegalArgumentException("system_field_name is required");
        }
        if (fieldDictionaryRepository.existsById(key)) {
            throw new IllegalArgumentException("system_field_name already exists: " + key);
        }
        FieldDictionary entity = FieldDictionary.builder().systemFieldName(key).build();
        applyMutableFields(entity, toUpdateShape(req));
        fieldDictionaryRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public FieldDictionaryResponse update(String systemFieldName, UpdateFieldDictionaryRequest req) {
        FieldDictionary entity = requireField(systemFieldName);
        applyMutableFields(entity, req);
        fieldDictionaryRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public void delete(String systemFieldName) {
        String key = systemFieldName.trim();
        if (!fieldDictionaryRepository.existsById(key)) {
            throw new NotFoundException("Field not found: " + key);
        }
        if (caseDiscoveryFieldRepository.existsBySystemField(key)) {
            throw new IllegalArgumentException(
                    "Cannot delete field in use by case discovery data. Clear case projections first."
            );
        }
        if (questionFieldMappingRepository.existsBySystemField(key)) {
            throw new IllegalArgumentException(
                    "Cannot delete field referenced by question mappings. Remove mappings first."
            );
        }
        fieldDictionaryRepository.deleteById(key);
    }

    private FieldDictionary requireField(String systemFieldName) {
        return fieldDictionaryRepository.findById(systemFieldName.trim())
                .orElseThrow(() -> new NotFoundException("Field not found: " + systemFieldName));
    }

    private static String trimOrNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private static String truncate(String value, int maxLen) {
        return FieldDictionaryCsvRowMapper.truncate(trimOrNull(value), maxLen);
    }

    private static void applyMutableFields(FieldDictionary entity, UpdateFieldDictionaryRequest req) {
        entity.setRowNo(req.rowNo());
        entity.setDataDomain(truncate(req.dataDomain(), 200));
        entity.setDataItem(truncate(req.dataItem(), 200));
        entity.setDetailFieldGroup(truncate(req.detailFieldGroup(), 200));
        entity.setDetailFieldNo(req.detailFieldNo());
        entity.setDetailFieldName(truncate(req.detailFieldName(), 200));
        entity.setFieldDescription(trimOrNull(req.fieldDescription()));
        entity.setDataType(truncate(req.dataType(), 100));
        entity.setMandatoryLevel(truncate(req.mandatoryLevel(), 50));
        entity.setAppliesTo(truncate(req.appliesTo(), 100));
        entity.setSuggestedSource(trimOrNull(req.suggestedSource()));
        entity.setValidationRule(trimOrNull(req.validationRule()));
        entity.setUsedFor(trimOrNull(req.usedFor()));
        entity.setSensitivity(truncate(req.sensitivity(), 100));
        entity.setUpdateFrequency(truncate(req.updateFrequency(), 100));
        entity.setMissingDataAction(trimOrNull(req.missingDataAction()));
        entity.setExampleValue(trimOrNull(req.exampleValue()));
        entity.setNotes(trimOrNull(req.notes()));
    }

    private static UpdateFieldDictionaryRequest toUpdateShape(CreateFieldDictionaryRequest req) {
        return new UpdateFieldDictionaryRequest(
                req.rowNo(),
                req.dataDomain(),
                req.dataItem(),
                req.detailFieldGroup(),
                req.detailFieldNo(),
                req.detailFieldName(),
                req.fieldDescription(),
                req.dataType(),
                req.mandatoryLevel(),
                req.appliesTo(),
                req.suggestedSource(),
                req.validationRule(),
                req.usedFor(),
                req.sensitivity(),
                req.updateFrequency(),
                req.missingDataAction(),
                req.exampleValue(),
                req.notes()
        );
    }

    static FieldDictionaryResponse toResponse(FieldDictionary e) {
        return new FieldDictionaryResponse(
                e.getSystemFieldName(),
                e.getRowNo(),
                e.getDataDomain(),
                e.getDataItem(),
                e.getDetailFieldGroup(),
                e.getDetailFieldNo(),
                e.getDetailFieldName(),
                e.getFieldDescription(),
                e.getDataType(),
                e.getMandatoryLevel(),
                e.getAppliesTo(),
                e.getSuggestedSource(),
                e.getValidationRule(),
                e.getUsedFor(),
                e.getSensitivity(),
                e.getUpdateFrequency(),
                e.getMissingDataAction(),
                e.getExampleValue(),
                e.getNotes(),
                e.getCreatedAt()
        );
    }
}
