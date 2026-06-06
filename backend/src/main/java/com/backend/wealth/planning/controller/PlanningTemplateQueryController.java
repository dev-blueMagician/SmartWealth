package com.backend.wealth.planning.controller;

import com.backend.wealth.planning.dto.PlanTemplateResponse;
import com.backend.wealth.planning.service.PlanTemplateRegistryService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/planning/templates")
@RequiredArgsConstructor
@Tag(name = "Planning — Templates (read)")
public class PlanningTemplateQueryController {

    private final PlanTemplateRegistryService planTemplateRegistryService;

    @GetMapping
    public List<PlanTemplateResponse> listActiveTemplates() {
        return planTemplateRegistryService.listActive();
    }
}
