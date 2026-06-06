package com.backend.wealth.execution.controller;

import com.backend.wealth.execution.service.ExecutionLifecycleService;
import com.backend.wealth.openapi.model.ExecutionInstructionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
public class ClientExecutionQueryController {

    private final ExecutionLifecycleService executionLifecycleService;

    /** Lists execution instructions whose recommendation chain belongs to this client. */
    @GetMapping("/clients/{clientId}/execution/instructions")
    public ResponseEntity<List<ExecutionInstructionResponse>> listExecutionInstructionsForClient(
            @PathVariable UUID clientId
    ) {
        return ResponseEntity.ok(executionLifecycleService.listInstructionsByClientId(clientId));
    }
}
