package com.backend.wealth.planning.dto;

import java.util.UUID;

public record ExportPlanningDraftRequest(
        UUID templateId,
        Boolean refreshCompose,
        /**
         * auto (default): LLM-only when sectionContent exists, else fill template.
         * llm_only: fresh Word from LLM sections only.
         * merge_template: fill uploaded DOCX placeholders only.
         */
        String exportMode
) {
}
