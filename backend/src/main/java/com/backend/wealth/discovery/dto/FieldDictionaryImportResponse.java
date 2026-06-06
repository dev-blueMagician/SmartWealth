package com.backend.wealth.discovery.dto;

import java.util.List;

public record FieldDictionaryImportResponse(
        int rowsRead,
        int fieldsCreated,
        int fieldsUpdated,
        int fieldsSkipped,
        long totalInDatabase,
        List<String> errors
) {
}
