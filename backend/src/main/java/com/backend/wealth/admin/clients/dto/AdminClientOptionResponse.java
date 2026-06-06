package com.backend.wealth.admin.clients.dto;

import java.util.UUID;

public record AdminClientOptionResponse(UUID id, String name, String status) {
}
