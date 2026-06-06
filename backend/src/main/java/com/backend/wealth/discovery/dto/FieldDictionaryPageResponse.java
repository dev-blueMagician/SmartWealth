package com.backend.wealth.discovery.dto;

import java.util.List;

public record FieldDictionaryPageResponse(
        List<FieldDictionaryResponse> items,
        long total,
        int page,
        int size
) {
}
