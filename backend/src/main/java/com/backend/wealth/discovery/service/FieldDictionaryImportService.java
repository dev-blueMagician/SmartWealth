package com.backend.wealth.discovery.service;

import com.backend.wealth.discovery.dto.FieldDictionaryImportResponse;
import com.backend.wealth.discovery.model.FieldDictionary;
import com.backend.wealth.discovery.repository.FieldDictionaryRepository;
import com.backend.wealth.discovery.support.DiscoveryCsvParser;
import com.backend.wealth.discovery.support.FieldDictionaryCsvRowMapper;
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
public class FieldDictionaryImportService {

    private final FieldDictionaryRepository fieldDictionaryRepository;

    @Transactional
    public FieldDictionaryImportResponse importCsv(MultipartFile file, boolean updateExisting) throws IOException {
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
        List<String> errors = new ArrayList<>();

        for (int i = 0; i < csvRows.size(); i++) {
            int rowNum = i + 2;
            try {
                FieldDictionaryCsvRowMapper.ParsedRow parsed =
                        FieldDictionaryCsvRowMapper.parse(csvRows.get(i));
                if (!StringUtils.hasText(parsed.systemFieldName())) {
                    errors.add("Row " + rowNum + ": missing system field name");
                    continue;
                }

                String fieldName = FieldDictionaryCsvRowMapper.truncate(parsed.systemFieldName(), 200);
                boolean exists = fieldDictionaryRepository.existsById(fieldName);

                if (exists && !updateExisting) {
                    skipped++;
                    continue;
                }

                FieldDictionary entity = exists
                        ? fieldDictionaryRepository.findById(fieldName).orElseThrow()
                        : FieldDictionary.builder().systemFieldName(fieldName).build();

                applyParsed(entity, parsed);
                fieldDictionaryRepository.save(entity);

                if (exists) {
                    updated++;
                } else {
                    created++;
                }
            } catch (Exception ex) {
                errors.add("Row " + rowNum + ": " + ex.getMessage());
            }
        }

        return new FieldDictionaryImportResponse(
                csvRows.size(),
                created,
                updated,
                skipped,
                fieldDictionaryRepository.count(),
                errors
        );
    }

    private static void applyParsed(FieldDictionary entity, FieldDictionaryCsvRowMapper.ParsedRow parsed) {
        entity.setRowNo(parsed.rowNo());
        entity.setDataDomain(FieldDictionaryCsvRowMapper.truncate(parsed.dataDomain(), 200));
        entity.setDataItem(FieldDictionaryCsvRowMapper.truncate(parsed.dataItem(), 200));
        entity.setDetailFieldGroup(FieldDictionaryCsvRowMapper.truncate(parsed.detailFieldGroup(), 200));
        entity.setDetailFieldNo(parsed.detailFieldNo());
        entity.setDetailFieldName(FieldDictionaryCsvRowMapper.truncate(parsed.detailFieldName(), 200));
        entity.setFieldDescription(parsed.fieldDescription());
        entity.setDataType(FieldDictionaryCsvRowMapper.truncate(parsed.dataType(), 100));
        entity.setMandatoryLevel(FieldDictionaryCsvRowMapper.truncate(parsed.mandatoryLevel(), 50));
        entity.setAppliesTo(FieldDictionaryCsvRowMapper.truncate(parsed.appliesTo(), 100));
        entity.setSuggestedSource(parsed.suggestedSource());
        entity.setValidationRule(parsed.validationRule());
        entity.setUsedFor(parsed.usedFor());
        entity.setSensitivity(FieldDictionaryCsvRowMapper.truncate(parsed.sensitivity(), 100));
        entity.setUpdateFrequency(FieldDictionaryCsvRowMapper.truncate(parsed.updateFrequency(), 100));
        entity.setMissingDataAction(parsed.missingDataAction());
        entity.setExampleValue(parsed.exampleValue());
        entity.setNotes(parsed.notes());
    }
}
