package com.backend.wealth.discovery.service;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.discovery.dto.AnswerResponse;
import com.backend.wealth.discovery.dto.SubmitAnswerRequest;
import com.backend.wealth.discovery.model.QuestionAnswer;
import com.backend.wealth.discovery.model.QuestionDefinition;
import com.backend.wealth.discovery.repository.QuestionAnswerRepository;
import com.backend.wealth.exception.NotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class QuestionAnswerService {

    private final QuestionAnswerRepository questionAnswerRepository;
    private final WealthCaseRepository wealthCaseRepository;
    private final QuestionService questionService;
    private final ObjectMapper objectMapper;
    private final DiscoveryProjectionService discoveryProjectionService;

    @Transactional(readOnly = true)
    public List<AnswerResponse> listByCase(UUID caseId) {
        if (!wealthCaseRepository.existsById(caseId)) {
            throw new NotFoundException("case not found: " + caseId);
        }
        return questionAnswerRepository.findByWealthCase_IdOrderByQuestion_QuestionIdAscBlockIndexAsc(caseId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AnswerResponse submit(SubmitAnswerRequest req) {
        WealthCase wealthCase = wealthCaseRepository.findById(req.caseId())
                .orElseThrow(() -> new NotFoundException("case not found: " + req.caseId()));
        QuestionDefinition question = questionService.requireQuestion(req.questionId());
        int blockIndex = req.blockIndex() != null ? req.blockIndex() : 0;
        JsonNode answerValue = req.answerValue();
        if (answerValue == null || answerValue.isNull()) {
            answerValue = objectMapper.nullNode();
        }

        QuestionAnswer entity = questionAnswerRepository
                .findByWealthCase_IdAndQuestion_QuestionIdAndBlockIndex(
                        req.caseId(), question.getQuestionId(), blockIndex)
                .orElseGet(() -> QuestionAnswer.builder()
                        .wealthCase(wealthCase)
                        .question(question)
                        .blockIndex(blockIndex)
                        .build());
        entity.setAnswerValue(answerValue);
        questionAnswerRepository.save(entity);
        discoveryProjectionService.rebuild(req.caseId());
        return toResponse(entity);
    }

    private AnswerResponse toResponse(QuestionAnswer e) {
        return new AnswerResponse(
                e.getId(),
                e.getWealthCase().getId(),
                e.getQuestion().getQuestionId(),
                e.getBlockIndex(),
                e.getAnswerValue(),
                e.getCreatedAt()
        );
    }
}
