package com.backend.wealth.auth.web.dto;

import java.util.List;
import java.util.UUID;

public record MeResponse(
        UUID userId,
        String username,
        String email,
        List<String> roles
) {
}
