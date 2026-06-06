package com.backend.wealth.admin.aiengine;

import com.backend.wealth.admin.aiengine.dto.CasePhaseResponse;
import com.backend.wealth.admin.aiengine.dto.UpdateCasePhaseRequest;
import com.backend.wealth.admin.aiengine.dto.UpsertCasePhaseRequest;
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

@RestController
@RequestMapping("/api/admin/ai-engine/case-phases")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Admin AI Engine — Case phases")
public class AdminCasePhaseController {

    private final AdminCasePhaseService adminCasePhaseService;

    @GetMapping
    public List<CasePhaseResponse> listAll() {
        return adminCasePhaseService.listAll();
    }

    @GetMapping("/{phaseCode}")
    public CasePhaseResponse get(@PathVariable String phaseCode) {
        return adminCasePhaseService.get(phaseCode);
    }

    @PostMapping
    public ResponseEntity<CasePhaseResponse> create(@Valid @RequestBody UpsertCasePhaseRequest request) {
        CasePhaseResponse body = adminCasePhaseService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{phaseCode}")
    public CasePhaseResponse update(@PathVariable String phaseCode, @Valid @RequestBody UpdateCasePhaseRequest request) {
        return adminCasePhaseService.update(phaseCode, request);
    }

    @DeleteMapping("/{phaseCode}")
    public ResponseEntity<Void> delete(@PathVariable String phaseCode) {
        adminCasePhaseService.delete(phaseCode);
        return ResponseEntity.noContent().build();
    }
}
