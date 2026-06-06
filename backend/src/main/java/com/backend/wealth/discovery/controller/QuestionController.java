package com.backend.wealth.discovery.controller;

import com.backend.wealth.discovery.dto.CreateQuestionRequest;
import com.backend.wealth.discovery.dto.QuestionImportResponse;
import com.backend.wealth.discovery.dto.QuestionResponse;
import com.backend.wealth.discovery.dto.UpdateQuestionRequest;
import com.backend.wealth.discovery.service.QuestionImportService;
import com.backend.wealth.discovery.service.QuestionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/questions")
@RequiredArgsConstructor
@Tag(name = "Discovery — Questions")
public class QuestionController {

    private final QuestionService questionService;
    private final QuestionImportService questionImportService;

    @GetMapping
    public List<QuestionResponse> list(
            @RequestParam(required = false) String module,
            @RequestParam(required = false) String section
    ) {
        return questionService.list(module, section);
    }

    @PostMapping
    public ResponseEntity<QuestionResponse> create(@Valid @RequestBody CreateQuestionRequest request) {
        QuestionResponse body = questionService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ResponseEntity<QuestionImportResponse> importCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "updateExisting", defaultValue = "false") boolean updateExisting
    ) throws IOException {
        QuestionImportResponse body = questionImportService.importCsv(file, updateExisting);
        return ResponseEntity.status(HttpStatus.OK).body(body);
    }

    @PutMapping("/{questionId}")
    public QuestionResponse update(
            @PathVariable String questionId,
            @Valid @RequestBody UpdateQuestionRequest request
    ) {
        return questionService.update(questionId, request);
    }

    @DeleteMapping("/{questionId}")
    public ResponseEntity<Void> delete(@PathVariable String questionId) {
        questionService.delete(questionId);
        return ResponseEntity.noContent().build();
    }
}
