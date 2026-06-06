package com.backend.wealth.discovery.controller;

import com.backend.wealth.discovery.dto.AnswerResponse;
import com.backend.wealth.discovery.dto.SubmitAnswerRequest;
import com.backend.wealth.discovery.service.QuestionAnswerService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/answers")
@RequiredArgsConstructor
@Tag(name = "Discovery — Answers")
public class AnswerController {

    private final QuestionAnswerService questionAnswerService;

    @GetMapping
    public List<AnswerResponse> listByCase(@RequestParam UUID caseId) {
        return questionAnswerService.listByCase(caseId);
    }

    @PostMapping
    public ResponseEntity<AnswerResponse> submit(@Valid @RequestBody SubmitAnswerRequest request) {
        AnswerResponse body = questionAnswerService.submit(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
