package com.backend.wealth.discovery.controller;

import com.backend.wealth.discovery.dto.DiscoveryAiTextResponse;
import com.backend.wealth.discovery.dto.DiscoveryExplainQuestionRequest;
import com.backend.wealth.discovery.dto.DiscoveryMissingSummaryRequest;
import com.backend.wealth.discovery.dto.DiscoverySuggestAnswerRequest;
import com.backend.wealth.discovery.dto.DiscoverySuggestMappingRequest;
import com.backend.wealth.discovery.dto.DiscoverySuggestMappingResponse;
import com.backend.wealth.discovery.service.DiscoveryAiService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/discovery/ai")
@RequiredArgsConstructor
@Tag(name = "Discovery — AI assist")
public class DiscoveryAiController {

    private final DiscoveryAiService discoveryAiService;

    @PostMapping("/suggest-answer")
    public DiscoveryAiTextResponse suggestAnswer(@Valid @RequestBody DiscoverySuggestAnswerRequest request) {
        return new DiscoveryAiTextResponse(discoveryAiService.suggestAnswer(request));
    }

    @PostMapping("/explain-question")
    public DiscoveryAiTextResponse explainQuestion(@Valid @RequestBody DiscoveryExplainQuestionRequest request) {
        return new DiscoveryAiTextResponse(discoveryAiService.explainQuestion(request));
    }

    @PostMapping("/missing-summary")
    public DiscoveryAiTextResponse missingSummary(@Valid @RequestBody DiscoveryMissingSummaryRequest request) {
        return new DiscoveryAiTextResponse(discoveryAiService.missingSummary(request));
    }

    @PostMapping("/suggest-mapping")
    public DiscoverySuggestMappingResponse suggestMapping(
            @Valid @RequestBody DiscoverySuggestMappingRequest request
    ) {
        return discoveryAiService.suggestMapping(request);
    }
}
