package com.backend.wealth.admin.aiengine;

import com.backend.wealth.admin.aiengine.dto.AiLlmProfileResponse;
import com.backend.wealth.admin.aiengine.dto.UpsertAiLlmProfileRequest;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/ai-engine/llm-profiles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin AI Engine — LLM profiles")
public class AdminAiLlmProfileController {

    private final AdminAiLlmProfileService adminAiLlmProfileService;

    @GetMapping
    public List<AiLlmProfileResponse> list() {
        return adminAiLlmProfileService.list();
    }

    @GetMapping("/active")
    public AiLlmProfileResponse active() {
        return adminAiLlmProfileService.getActive();
    }

    @GetMapping("/{id}")
    public AiLlmProfileResponse get(@PathVariable UUID id) {
        return adminAiLlmProfileService.get(id);
    }

    @PostMapping
    public ResponseEntity<AiLlmProfileResponse> create(@Valid @RequestBody UpsertAiLlmProfileRequest request) {
        AiLlmProfileResponse body = adminAiLlmProfileService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{id}")
    public AiLlmProfileResponse update(@PathVariable UUID id, @Valid @RequestBody UpsertAiLlmProfileRequest request) {
        return adminAiLlmProfileService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        adminAiLlmProfileService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
