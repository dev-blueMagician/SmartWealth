package com.backend.wealth.discovery.controller;

import com.backend.wealth.discovery.dto.CreateMappingRequest;
import com.backend.wealth.discovery.dto.MappingResponse;
import com.backend.wealth.discovery.dto.UpdateMappingRequest;
import com.backend.wealth.discovery.service.QuestionFieldMappingService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/mappings")
@RequiredArgsConstructor
@Tag(name = "Discovery — Field mappings")
public class QuestionFieldMappingController {

    private final QuestionFieldMappingService questionFieldMappingService;

    @GetMapping
    public List<MappingResponse> listAll() {
        return questionFieldMappingService.listAll();
    }

    @PostMapping
    public ResponseEntity<MappingResponse> create(@Valid @RequestBody CreateMappingRequest request) {
        MappingResponse body = questionFieldMappingService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{id}")
    public MappingResponse update(@PathVariable UUID id, @Valid @RequestBody UpdateMappingRequest request) {
        return questionFieldMappingService.update(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        questionFieldMappingService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
