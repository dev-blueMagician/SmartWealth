package com.backend.wealth.admin.users.dto;

import java.util.List;
import java.util.UUID;

public record UserSummaryResponse(
        UUID id,
        String username,
        String email,
        boolean enabled,
        List<String> roles,
        UUID clientId
) {
}
