package com.backend.wealth.discovery.service;

import com.backend.wealth.discovery.dto.CreateQuestionRequest;
import com.backend.wealth.discovery.dto.QuestionResponse;
import com.backend.wealth.discovery.dto.UpdateQuestionRequest;
import com.backend.wealth.discovery.model.QuestionDefinition;
import com.backend.wealth.discovery.repository.QuestionDefinitionRepository;
import com.backend.wealth.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionDefinitionRepository questionDefinitionRepository;

    @Transactional(readOnly = true)
    public List<QuestionResponse> list(String module, String section) {
        List<QuestionDefinition> rows;
        if (StringUtils.hasText(module) && StringUtils.hasText(section)) {
            rows = questionDefinitionRepository.findByModuleAndSectionOrderByQuestionIdAsc(
                    module.trim(), section.trim());
        } else if (StringUtils.hasText(module)) {
            rows = questionDefinitionRepository.findByModuleOrderByQuestionIdAsc(module.trim());
        } else if (StringUtils.hasText(section)) {
            rows = questionDefinitionRepository.findBySectionOrderByQuestionIdAsc(section.trim());
        } else {
            rows = questionDefinitionRepository.findAllByOrderByQuestionIdAsc();
        }
        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional
    public QuestionResponse create(CreateQuestionRequest req) {
        String id = req.questionId().trim();
        if (questionDefinitionRepository.existsById(id)) {
            throw new IllegalArgumentException("question_id already exists: " + id);
        }
        QuestionDefinition entity = QuestionDefinition.builder()
                .questionId(id)
                .module(trimOrNull(req.module()))
                .section(trimOrNull(req.section()))
                .questionText(req.questionText())
                .answerType(trimOrNull(req.answerType()))
                .repeatable(Boolean.TRUE.equals(req.repeatable()))
                .requiredFlag(req.requiredFlag())
                .conditionalFlag(req.conditionalFlag())
                .build();
        questionDefinitionRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public QuestionResponse update(String questionId, UpdateQuestionRequest req) {
        QuestionDefinition entity = questionDefinitionRepository.findById(questionId.trim())
                .orElseThrow(() -> new NotFoundException("question not found: " + questionId));
        if (req.module() != null) {
            entity.setModule(trimOrNull(req.module()));
        }
        if (req.section() != null) {
            entity.setSection(trimOrNull(req.section()));
        }
        if (req.questionText() != null) {
            entity.setQuestionText(req.questionText());
        }
        if (req.answerType() != null) {
            entity.setAnswerType(trimOrNull(req.answerType()));
        }
        if (req.repeatable() != null) {
            entity.setRepeatable(req.repeatable());
        }
        if (req.requiredFlag() != null) {
            entity.setRequiredFlag(req.requiredFlag());
        }
        if (req.conditionalFlag() != null) {
            entity.setConditionalFlag(req.conditionalFlag());
        }
        questionDefinitionRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public void delete(String questionId) {
        if (!questionDefinitionRepository.existsById(questionId.trim())) {
            throw new NotFoundException("question not found: " + questionId);
        }
        questionDefinitionRepository.deleteById(questionId.trim());
    }

    @Transactional(readOnly = true)
    public QuestionDefinition requireQuestion(String questionId) {
        return questionDefinitionRepository.findById(questionId.trim())
                .orElseThrow(() -> new NotFoundException("question not found: " + questionId));
    }

    private QuestionResponse toResponse(QuestionDefinition e) {
        return new QuestionResponse(
                e.getQuestionId(),
                e.getModule(),
                e.getSection(),
                e.getQuestionText(),
                e.getAnswerType(),
                Boolean.TRUE.equals(e.getRepeatable()),
                e.getRequiredFlag(),
                e.getConditionalFlag(),
                e.getCreatedAt()
        );
    }

    private static String trimOrNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
