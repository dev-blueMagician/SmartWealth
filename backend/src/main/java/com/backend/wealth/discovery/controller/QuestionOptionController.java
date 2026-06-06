package com.backend.wealth.discovery.controller;

import com.backend.wealth.discovery.dto.CreateQuestionOptionRequest;
import com.backend.wealth.discovery.dto.QuestionOptionResponse;
import com.backend.wealth.discovery.service.QuestionOptionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/questions/{questionId}/options")
@RequiredArgsConstructor
@Tag(name = "Discovery — Question options")
public class QuestionOptionController {

    private final QuestionOptionService questionOptionService;

    @GetMapping
    public List<QuestionOptionResponse> list(@PathVariable String questionId) {
        return questionOptionService.listByQuestion(questionId);
    }

    @PostMapping
    public ResponseEntity<QuestionOptionResponse> create(
            @PathVariable String questionId,
            @Valid @RequestBody CreateQuestionOptionRequest request
    ) {
        QuestionOptionResponse body = questionOptionService.create(questionId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
