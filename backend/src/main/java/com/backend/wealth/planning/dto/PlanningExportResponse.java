package com.backend.wealth.planning.dto;

import java.util.UUID;

public record PlanningExportResponse(
        UUID artifactId,
        UUID documentId,
        String filename,
        String downloadPath
) {
}
