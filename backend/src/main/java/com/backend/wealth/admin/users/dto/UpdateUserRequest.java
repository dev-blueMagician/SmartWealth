package com.backend.wealth.admin.users.dto;

import java.util.List;
import java.util.UUID;

public record UpdateUserRequest(
        Boolean enabled,
        List<String> roles,
        String password,
        String email,
        UUID clientId
) {
}
