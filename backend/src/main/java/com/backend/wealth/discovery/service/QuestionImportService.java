package com.backend.wealth.discovery.service;

import com.backend.wealth.discovery.dto.CreateQuestionRequest;
import com.backend.wealth.discovery.dto.QuestionImportResponse;
import com.backend.wealth.discovery.dto.UpdateQuestionRequest;
import com.backend.wealth.discovery.model.QuestionDefinition;
import com.backend.wealth.discovery.model.QuestionFieldMapping;
import com.backend.wealth.discovery.model.QuestionOption;
import com.backend.wealth.discovery.repository.QuestionDefinitionRepository;
import com.backend.wealth.discovery.repository.QuestionFieldMappingRepository;
import com.backend.wealth.discovery.repository.QuestionOptionRepository;
import com.backend.wealth.discovery.support.DiscoveryCsvParser;
import com.backend.wealth.discovery.support.DiscoveryCsvRowMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class QuestionImportService {

    private final QuestionDefinitionRepository questionDefinitionRepository;
    private final QuestionOptionRepository questionOptionRepository;
    private final QuestionFieldMappingRepository questionFieldMappingRepository;
    private final QuestionService questionService;

    @Transactional
    public QuestionImportResponse importCsv(MultipartFile file, boolean updateExisting) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("CSV file is required.");
        }
        String name = file.getOriginalFilename();
        if (name != null && !name.toLowerCase(Locale.ROOT).endsWith(".csv")) {
            throw new IllegalArgumentException("File must be a .csv file.");
        }

        List<Map<String, String>> csvRows;
        try (InputStream in = file.getInputStream()) {
            csvRows = DiscoveryCsvParser.parse(in);
        }

        int created = 0;
        int updated = 0;
        int skipped = 0;
        int optionsCreated = 0;
        int mappingsCreated = 0;
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < csvRows.size(); i++) {
            int rowNum = i + 2;
            try {
                DiscoveryCsvRowMapper.ParsedRow parsed = DiscoveryCsvRowMapper.parse(csvRows.get(i));
                if (!StringUtils.hasText(parsed.questionId())) {
                    errors.add("Row " + rowNum + ": missing question id");
                    continue;
                }
                if (parsed.questionId().length() > 32) {
                    errors.add("Row " + rowNum + ": question id too long: " + parsed.questionId());
                    continue;
                }

                String qid = parsed.questionId().trim();
                boolean exists = questionDefinitionRepository.existsById(qid);

                if (exists && !updateExisting) {
                    skipped++;
                } else if (exists) {
                    questionService.update(qid, new UpdateQuestionRequest(
                            parsed.module(),
                            parsed.section(),
                            parsed.questionText(),
                            parsed.answerType(),
                            parsed.repeatable(),
                            parsed.requiredFlag(),
                            parsed.conditionalFlag()
                    ));
                    updated++;
                } else {
                    questionService.create(new CreateQuestionRequest(
                            qid,
                            parsed.module(),
                            parsed.section(),
                            parsed.questionText(),
                            parsed.answerType(),
                            parsed.repeatable(),
                            parsed.requiredFlag(),
                            parsed.conditionalFlag()
                    ));
                    created++;
                }

                QuestionDefinition question = questionDefinitionRepository.findById(qid)
                        .orElseThrow();

                optionsCreated += importOptions(question, parsed.optionLabels());
                mappingsCreated += importMapping(question, parsed.systemField());
            } catch (Exception ex) {
                errors.add("Row " + rowNum + ": " + ex.getMessage());
            }
        }

        return new QuestionImportResponse(
                csvRows.size(),
                created,
                updated,
                skipped,
                optionsCreated,
                mappingsCreated,
                errors
        );
    }

    private int importOptions(QuestionDefinition question, List<String> labels) {
        if (labels == null || labels.isEmpty()) {
            return 0;
        }
        int added = 0;
        for (String label : labels) {
            if (!StringUtils.hasText(label)) {
                continue;
            }
            String value = label.trim();
            if (value.length() > 100) {
                value = value.substring(0, 100);
            }
            String optionLabel = label.trim();
            if (optionLabel.length() > 200) {
                optionLabel = optionLabel.substring(0, 200);
            }
            if (questionOptionRepository.existsByQuestion_QuestionIdAndOptionValue(
                    question.getQuestionId(), value)) {
                continue;
            }
            QuestionOption option = QuestionOption.builder()
                    .question(question)
                    .optionValue(value)
                    .optionLabel(optionLabel)
                    .build();
            questionOptionRepository.save(option);
            added++;
        }
        return added;
    }

    private int importMapping(QuestionDefinition question, String systemField) {
        if (!StringUtils.hasText(systemField)) {
            return 0;
        }
        String field = systemField.trim();
        if (field.length() > 200) {
            field = field.substring(0, 200);
        }
        if (questionFieldMappingRepository.existsByQuestion_QuestionIdAndSystemField(
                question.getQuestionId(), field)) {
            return 0;
        }
        String entityType = inferEntityType(field);
        QuestionFieldMapping mapping = QuestionFieldMapping.builder()
                .question(question)
                .systemField(field)
                .entityType(entityType)
                .transformType(null)
                .build();
        questionFieldMappingRepository.save(mapping);
        return 1;
    }

    private static String inferEntityType(String systemField) {
        String lower = systemField.toLowerCase(Locale.ROOT);
        if (lower.contains("goal")) {
            return "goal";
        }
        if (lower.contains("asset") || lower.contains("investment") || lower.contains("portfolio")) {
            return "asset";
        }
        if (lower.contains("case") || lower.contains("planning scope")) {
            return "case";
        }
        return "client";
    }
}
