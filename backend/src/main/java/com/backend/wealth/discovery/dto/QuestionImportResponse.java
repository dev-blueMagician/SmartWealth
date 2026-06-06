package com.backend.wealth.discovery.dto;

import java.util.List;

public record QuestionImportResponse(
        int rowsRead,
        int questionsCreated,
        int questionsUpdated,
        int questionsSkipped,
        int optionsCreated,
        int mappingsCreated,
        List<String> errors
) {
}
