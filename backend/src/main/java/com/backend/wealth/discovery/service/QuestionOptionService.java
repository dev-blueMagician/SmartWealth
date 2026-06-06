package com.backend.wealth.discovery.service;

import com.backend.wealth.discovery.dto.CreateQuestionOptionRequest;
import com.backend.wealth.discovery.dto.QuestionOptionResponse;
import com.backend.wealth.discovery.model.QuestionDefinition;
import com.backend.wealth.discovery.model.QuestionOption;
import com.backend.wealth.discovery.repository.QuestionOptionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
public class QuestionOptionService {

    private final QuestionOptionRepository questionOptionRepository;
    private final QuestionService questionService;

    @Transactional(readOnly = true)
    public List<QuestionOptionResponse> listByQuestion(String questionId) {
        questionService.requireQuestion(questionId);
        return questionOptionRepository.findByQuestion_QuestionIdOrderByOptionLabelAsc(questionId.trim())
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public QuestionOptionResponse create(String questionId, CreateQuestionOptionRequest req) {
        QuestionDefinition question = questionService.requireQuestion(questionId);
        QuestionOption entity = QuestionOption.builder()
                .question(question)
                .optionValue(trimOrNull(req.optionValue()))
                .optionLabel(trimOrNull(req.optionLabel()))
                .build();
        questionOptionRepository.save(entity);
        return toResponse(entity);
    }

    private QuestionOptionResponse toResponse(QuestionOption e) {
        return new QuestionOptionResponse(
                e.getId(),
                e.getQuestion().getQuestionId(),
                e.getOptionValue(),
                e.getOptionLabel()
        );
    }

    private static String trimOrNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
