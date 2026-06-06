package com.backend.wealth.admin.aiengine;

import com.backend.wealth.admin.aiengine.dto.AiLlmProfileResponse;
import com.backend.wealth.admin.aiengine.dto.UpsertAiLlmProfileRequest;
import com.backend.wealth.cases.model.AiLlmProfileEntity;
import com.backend.wealth.cases.repository.AiLlmProfileRepository;
import com.backend.wealth.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AdminAiLlmProfileService {

    private final AiLlmProfileRepository aiLlmProfileRepository;

    @Transactional(readOnly = true)
    public List<AiLlmProfileResponse> list() {
        return aiLlmProfileRepository.findAllByOrderByDisplayNameAsc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public AiLlmProfileResponse get(UUID id) {
        return aiLlmProfileRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("ai_llm_profile not found: " + id));
    }

    @Transactional(readOnly = true)
    public AiLlmProfileResponse getActive() {
        return aiLlmProfileRepository.findByIsActiveTrue()
                .map(this::toResponse)
                .orElseThrow(() -> new NotFoundException("No active ai_llm_profile."));
    }

    @Transactional
    public AiLlmProfileResponse create(UpsertAiLlmProfileRequest req) {
        if (aiLlmProfileRepository.findByCode(req.code().trim()).isPresent()) {
            throw new IllegalArgumentException("Profile code already exists: " + req.code());
        }
        LocalDateTime now = LocalDateTime.now();
        boolean active = Boolean.TRUE.equals(req.active());
        if (active) {
            deactivateAll();
        }
        AiLlmProfileEntity e = AiLlmProfileEntity.builder()
                .code(req.code().trim())
                .displayName(req.displayName().trim())
                .llmProvider(req.llmProvider().trim())
                .deepseekBaseUrl(trimToNull(req.deepseekBaseUrl()))
                .deepseekModel(trimToNull(req.deepseekModel()))
                .azureOpenaiEndpoint(trimToNull(req.azureOpenaiEndpoint()))
                .azureOpenaiDeployment(trimToNull(req.azureOpenaiDeployment()))
                .azureOpenaiApiVersion(trimToNull(req.azureOpenaiApiVersion()))
                .deepseekApiKey(trimToNull(req.deepseekApiKey()))
                .azureOpenaiApiKey(trimToNull(req.azureOpenaiApiKey()))
                .assessmentLlmEnabled(Boolean.TRUE.equals(req.assessmentLlmEnabled()))
                .completenessLoopGraphEnabled(Boolean.TRUE.equals(req.completenessLoopGraphEnabled()))
                .isActive(active)
                .createdAt(now)
                .updatedAt(now)
                .build();
        aiLlmProfileRepository.save(e);
        return toResponse(e);
    }

    @Transactional
    public AiLlmProfileResponse update(UUID id, UpsertAiLlmProfileRequest req) {
        AiLlmProfileEntity e = aiLlmProfileRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("ai_llm_profile not found: " + id));

        aiLlmProfileRepository.findByCode(req.code().trim()).filter(other -> !other.getId().equals(id))
                .ifPresent(other -> {
                    throw new IllegalArgumentException("Profile code already exists: " + req.code());
                });

        boolean active = Boolean.TRUE.equals(req.active());
        if (active) {
            deactivateAllExcept(id);
        }

        e.setCode(req.code().trim());
        e.setDisplayName(req.displayName().trim());
        e.setLlmProvider(req.llmProvider().trim());
        e.setDeepseekBaseUrl(trimToNull(req.deepseekBaseUrl()));
        e.setDeepseekModel(trimToNull(req.deepseekModel()));
        e.setAzureOpenaiEndpoint(trimToNull(req.azureOpenaiEndpoint()));
        e.setAzureOpenaiDeployment(trimToNull(req.azureOpenaiDeployment()));
        e.setAzureOpenaiApiVersion(trimToNull(req.azureOpenaiApiVersion()));
        if (req.deepseekApiKey() != null) {
            e.setDeepseekApiKey(trimToNull(req.deepseekApiKey()));
        }
        if (req.azureOpenaiApiKey() != null) {
            e.setAzureOpenaiApiKey(trimToNull(req.azureOpenaiApiKey()));
        }
        e.setAssessmentLlmEnabled(Boolean.TRUE.equals(req.assessmentLlmEnabled()));
        e.setCompletenessLoopGraphEnabled(Boolean.TRUE.equals(req.completenessLoopGraphEnabled()));
        e.setIsActive(active);
        e.setUpdatedAt(LocalDateTime.now());
        aiLlmProfileRepository.save(e);
        return toResponse(e);
    }

    @Transactional
    public void delete(UUID id) {
        if (!aiLlmProfileRepository.existsById(id)) {
            throw new NotFoundException("ai_llm_profile not found: " + id);
        }
        aiLlmProfileRepository.deleteById(id);
    }

    private void deactivateAll() {
        for (AiLlmProfileEntity e : aiLlmProfileRepository.findAll()) {
            if (Boolean.TRUE.equals(e.getIsActive())) {
                e.setIsActive(false);
                e.setUpdatedAt(LocalDateTime.now());
                aiLlmProfileRepository.save(e);
            }
        }
    }

    private void deactivateAllExcept(UUID keepId) {
        for (AiLlmProfileEntity e : aiLlmProfileRepository.findAll()) {
            if (!e.getId().equals(keepId) && Boolean.TRUE.equals(e.getIsActive())) {
                e.setIsActive(false);
                e.setUpdatedAt(LocalDateTime.now());
                aiLlmProfileRepository.save(e);
            }
        }
    }

    private static String trimToNull(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static boolean secretConfigured(String s) {
        return s != null && !s.isBlank();
    }

    private AiLlmProfileResponse toResponse(AiLlmProfileEntity e) {
        return new AiLlmProfileResponse(
                e.getId(),
                e.getCode(),
                e.getDisplayName(),
                e.getLlmProvider(),
                e.getDeepseekBaseUrl(),
                e.getDeepseekModel(),
                e.getAzureOpenaiEndpoint(),
                e.getAzureOpenaiDeployment(),
                e.getAzureOpenaiApiVersion(),
                secretConfigured(e.getDeepseekApiKey()),
                secretConfigured(e.getAzureOpenaiApiKey()),
                Boolean.TRUE.equals(e.getAssessmentLlmEnabled()),
                Boolean.TRUE.equals(e.getCompletenessLoopGraphEnabled()),
                Boolean.TRUE.equals(e.getIsActive()),
                e.getCreatedAt(),
                e.getUpdatedAt()
        );
    }
}
