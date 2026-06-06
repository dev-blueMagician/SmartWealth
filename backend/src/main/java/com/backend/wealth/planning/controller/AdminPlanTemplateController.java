package com.backend.wealth.planning.controller;

import com.backend.wealth.planning.dto.PlanTemplateResponse;
import com.backend.wealth.planning.service.PlanTemplateRegistryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/planning/templates")
@RequiredArgsConstructor
@Tag(name = "Planning — Template registry")
public class AdminPlanTemplateController {

    private final PlanTemplateRegistryService planTemplateRegistryService;

    @GetMapping
    public List<PlanTemplateResponse> listTemplates() {
        return planTemplateRegistryService.list();
    }

    @GetMapping("/{templateId}")
    public PlanTemplateResponse getTemplate(@PathVariable UUID templateId) {
        return planTemplateRegistryService.get(templateId);
    }

    @PostMapping(consumes = "multipart/form-data")
    public ResponseEntity<PlanTemplateResponse> uploadTemplate(
            @RequestParam String code,
            @RequestParam String name,
            @RequestParam(required = false) Integer versionNo,
            @RequestParam(required = false) String locale,
            @RequestParam(required = false) String productType,
            @RequestParam("docxFile") MultipartFile docxFile,
            @RequestParam(value = "mappingFile", required = false) MultipartFile mappingFile,
            Authentication authentication
    ) {
        PlanTemplateResponse body = planTemplateRegistryService.upload(
                code,
                name,
                versionNo,
                locale,
                productType,
                docxFile,
                mappingFile,
                authentication
        );
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PostMapping("/{templateId}/publish")
    public PlanTemplateResponse publish(@PathVariable UUID templateId) {
        return planTemplateRegistryService.publish(templateId);
    }

    @DeleteMapping("/{templateId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplate(@PathVariable UUID templateId) {
        planTemplateRegistryService.delete(templateId);
    }
}
