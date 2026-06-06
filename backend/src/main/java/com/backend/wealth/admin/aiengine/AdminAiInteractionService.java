package com.backend.wealth.admin.aiengine;

import com.backend.wealth.admin.aiengine.dto.AiInteractionResponse;
import com.backend.wealth.admin.aiengine.dto.UpdateAiInteractionRequest;
import com.backend.wealth.admin.aiengine.dto.UpsertAiInteractionRequest;
import com.backend.wealth.cases.model.AiInteractionEntity;
import com.backend.wealth.cases.model.CasePhaseEntity;
import com.backend.wealth.cases.repository.AiInteractionRepository;
import com.backend.wealth.cases.repository.CasePhaseRepository;
import com.backend.wealth.exception.NotFoundException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AdminAiInteractionService {

    private final AiInteractionRepository aiInteractionRepository;
    private final CasePhaseRepository casePhaseRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<AiInteractionResponse> list(String phaseCodeFilter) {
        List<AiInteractionEntity> rows = StringUtils.hasText(phaseCodeFilter)
                ? aiInteractionRepository.findAllByPhasePhaseCodeOrderByInteractionIdAsc(phaseCodeFilter.trim())
                : aiInteractionRepository.findAllByOrderByInteractionIdAsc();
        return rows.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public AiInteractionResponse get(String interactionId) {
        return aiInteractionRepository.findById(interactionId)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("ai_interaction not found: " + interactionId));
    }

    @Transactional
    public AiInteractionResponse create(UpsertAiInteractionRequest req) {
        String id = req.interactionId().trim();
        if (aiInteractionRepository.existsById(id)) {
            throw new IllegalArgumentException("interaction_id already exists: " + id);
        }
        CasePhaseEntity phase = casePhaseRepository.findById(req.phaseCode().trim())
                .orElseThrow(() -> new NotFoundException("case_phase not found: " + req.phaseCode()));

        JsonNode loop = req.loopInput();
        if (loop == null || loop.isNull()) {
            loop = objectMapper.createObjectNode();
        }

        LocalDateTime now = LocalDateTime.now();
        AiInteractionEntity entity = AiInteractionEntity.builder()
                .interactionId(id)
                .phase(phase)
                .loopInput(loop)
                .systemPrompt(req.systemPrompt())
                .createdAt(now)
                .updatedAt(now)
                .build();
        aiInteractionRepository.save(entity);
        return toResponse(entity);
    }

    @Transactional
    public void delete(String interactionId) {
        if (!aiInteractionRepository.existsById(interactionId)) {
            throw new NotFoundException("ai_interaction not found: " + interactionId);
        }
        aiInteractionRepository.deleteById(interactionId);
    }

    @Transactional
    public AiInteractionResponse update(String interactionId, UpdateAiInteractionRequest req) {
        AiInteractionEntity entity = aiInteractionRepository.findById(interactionId.trim())
                .orElseThrow(() -> new NotFoundException("ai_interaction not found: " + interactionId));
        CasePhaseEntity phase = casePhaseRepository.findById(req.phaseCode().trim())
                .orElseThrow(() -> new NotFoundException("case_phase not found: " + req.phaseCode()));

        JsonNode loop = req.loopInput();
        if (loop == null || loop.isNull()) {
            loop = objectMapper.createObjectNode();
        }
        entity.setPhase(phase);
        entity.setLoopInput(loop);
        entity.setSystemPrompt(req.systemPrompt());
        entity.setUpdatedAt(LocalDateTime.now());
        aiInteractionRepository.save(entity);
        return toResponse(entity);
    }

    private AiInteractionResponse toResponse(AiInteractionEntity e) {
        return new AiInteractionResponse(
                e.getInteractionId(),
                e.getPhase().getPhaseCode(),
                e.getLoopInput(),
                e.getSystemPrompt(),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
