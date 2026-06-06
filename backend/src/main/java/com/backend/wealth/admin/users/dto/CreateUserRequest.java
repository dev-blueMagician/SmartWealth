package com.backend.wealth.admin.users.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;
import java.util.UUID;

public record CreateUserRequest(
        @NotBlank String username,
        @NotBlank String password,
        String email,
        @NotEmpty List<String> roles,
        UUID clientId
) {
}
