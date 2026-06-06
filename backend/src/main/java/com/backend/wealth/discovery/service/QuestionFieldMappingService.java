package com.backend.wealth.discovery.service;

import com.backend.wealth.discovery.dto.CreateMappingRequest;
import com.backend.wealth.discovery.dto.MappingResponse;
import com.backend.wealth.discovery.dto.UpdateMappingRequest;
import com.backend.wealth.discovery.model.QuestionDefinition;
import com.backend.wealth.discovery.model.QuestionFieldMapping;
import com.backend.wealth.discovery.repository.FieldDictionaryRepository;
import com.backend.wealth.discovery.repository.QuestionFieldMappingRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class QuestionFieldMappingService {

    private final QuestionFieldMappingRepository questionFieldMappingRepository;
    private final FieldDictionaryRepository fieldDictionaryRepository;
    private final QuestionService questionService;

    @Transactional(readOnly = true)
    public List<MappingResponse> listAll() {
        return questionFieldMappingRepository.findAllByOrderByQuestion_QuestionIdAscSystemFieldAsc()
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public MappingResponse create(CreateMappingRequest req) {
        String systemField = requireDictionaryField(req.systemField());
        QuestionDefinition question = questionService.requireQuestion(req.questionId());
        QuestionFieldMapping entity = QuestionFieldMapping.builder()
                .question(question)
                .systemField(systemField)
                .entityType(trimOrNull(req.entityType()))
                .transformType(trimOrNull(req.transformType()))
                .build();
        questionFieldMappingRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public MappingResponse update(UUID id, UpdateMappingRequest req) {
        QuestionFieldMapping entity = questionFieldMappingRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("mapping not found: " + id));
        QuestionDefinition question = questionService.requireQuestion(req.questionId());
        entity.setQuestion(question);
        entity.setSystemField(requireDictionaryField(req.systemField()));
        entity.setEntityType(trimOrNull(req.entityType()));
        entity.setTransformType(trimOrNull(req.transformType()));
        questionFieldMappingRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public void delete(UUID id) {
        if (!questionFieldMappingRepository.existsById(id)) {
            throw new NotFoundException("mapping not found: " + id);
        }
        questionFieldMappingRepository.deleteById(id);
    }

    private MappingResponse toResponse(QuestionFieldMapping e) {
        return new MappingResponse(
                e.getId(),
                e.getQuestion().getQuestionId(),
                e.getSystemField(),
                e.getEntityType(),
                e.getTransformType(),
                e.getCreatedAt()
        );
    }

    private static String trimOrNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private String requireDictionaryField(String raw) {
        if (!StringUtils.hasText(raw)) {
            throw new BusinessException("system_field is required.");
        }
        String field = raw.trim();
        if (field.length() > 200) {
            field = field.substring(0, 200);
        }
        if (!fieldDictionaryRepository.existsById(field)) {
            throw new BusinessException(
                    "system_field not found in field_dictionary: " + field
                            + ". Import dictionary or pick a valid System Field Name."
            );
        }
        return field;
    }
}
