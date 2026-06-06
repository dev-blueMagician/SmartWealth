package com.backend.wealth.admin.aiengine;

import com.backend.wealth.admin.aiengine.dto.AiInteractionResponse;
import com.backend.wealth.admin.aiengine.dto.UpdateAiInteractionRequest;
import com.backend.wealth.admin.aiengine.dto.UpsertAiInteractionRequest;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/ai-engine/ai-interactions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin AI Engine — AI interactions")
public class AdminAiInteractionController {

    private final AdminAiInteractionService adminAiInteractionService;

    @GetMapping
    public List<AiInteractionResponse> list(@RequestParam(name = "phaseCode", required = false) String phaseCode) {
        return adminAiInteractionService.list(phaseCode);
    }

    @GetMapping("/{interactionId}")
    public AiInteractionResponse get(@PathVariable String interactionId) {
        return adminAiInteractionService.get(interactionId);
    }

    @PostMapping
    public ResponseEntity<AiInteractionResponse> create(@Valid @RequestBody UpsertAiInteractionRequest request) {
        AiInteractionResponse body = adminAiInteractionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{interactionId}")
    public AiInteractionResponse update(
            @PathVariable String interactionId,
            @Valid @RequestBody UpdateAiInteractionRequest request
    ) {
        return adminAiInteractionService.update(interactionId, request);
    }

    @DeleteMapping("/{interactionId}")
    public ResponseEntity<Void> delete(@PathVariable String interactionId) {
        adminAiInteractionService.delete(interactionId);
        return ResponseEntity.noContent().build();
    }
}
