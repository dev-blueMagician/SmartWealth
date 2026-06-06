package com.backend.wealth.auth.web.dto;

import java.util.List;
import java.util.UUID;

public record LoginResponse(
        String accessToken,
        String tokenType,
        UUID userId,
        String username,
        List<String> roles
) {
}
