package com.backend.wealth.discovery.controller;

import com.backend.wealth.discovery.dto.CreateFieldDictionaryRequest;
import com.backend.wealth.discovery.dto.FieldDictionaryImportResponse;
import com.backend.wealth.discovery.dto.FieldDictionaryPageResponse;
import com.backend.wealth.discovery.dto.FieldDictionaryResponse;
import com.backend.wealth.discovery.dto.UpdateFieldDictionaryRequest;
import com.backend.wealth.discovery.service.FieldDictionaryImportService;
import com.backend.wealth.discovery.service.FieldDictionaryService;
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
import java.util.Map;

@RestController
@RequestMapping("/field-dictionary")
@RequiredArgsConstructor
@Tag(name = "Discovery — Field dictionary")
public class FieldDictionaryController {

    private final FieldDictionaryService fieldDictionaryService;
    private final FieldDictionaryImportService fieldDictionaryImportService;

    @GetMapping
    public FieldDictionaryPageResponse list(
            @RequestParam(required = false) String dataDomain,
            @RequestParam(required = false) String mandatoryLevel,
            @RequestParam(required = false) String search,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size
    ) {
        return fieldDictionaryService.list(dataDomain, mandatoryLevel, search, page, size);
    }

    @GetMapping("/count")
    public Map<String, Long> count() {
        return Map.of("total", fieldDictionaryService.count());
    }

    @GetMapping("/{systemFieldName}")
    public FieldDictionaryResponse get(@PathVariable String systemFieldName) {
        return fieldDictionaryService.get(systemFieldName);
    }

    @PostMapping
    public ResponseEntity<FieldDictionaryResponse> create(
            @Valid @RequestBody CreateFieldDictionaryRequest request
    ) {
        FieldDictionaryResponse body = fieldDictionaryService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PutMapping("/{systemFieldName}")
    public FieldDictionaryResponse update(
            @PathVariable String systemFieldName,
            @Valid @RequestBody UpdateFieldDictionaryRequest request
    ) {
        return fieldDictionaryService.update(systemFieldName, request);
    }

    @DeleteMapping("/{systemFieldName}")
    public ResponseEntity<Void> delete(@PathVariable String systemFieldName) {
        fieldDictionaryService.delete(systemFieldName);
        return ResponseEntity.noContent().build();
    }

    @PostMapping(value = "/import", consumes = "multipart/form-data")
    public ResponseEntity<FieldDictionaryImportResponse> importCsv(
            @RequestParam("file") MultipartFile file,
            @RequestParam(name = "updateExisting", defaultValue = "false") boolean updateExisting
    ) throws IOException {
        FieldDictionaryImportResponse body = fieldDictionaryImportService.importCsv(file, updateExisting);
        return ResponseEntity.ok(body);
    }
}
