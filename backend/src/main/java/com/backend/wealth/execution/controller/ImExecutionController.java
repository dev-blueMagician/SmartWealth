package com.backend.wealth.execution.controller;

import com.backend.wealth.execution.service.ExecutionLifecycleService;
import com.backend.wealth.openapi.model.ExecutionInstructionCreateRequest;
import com.backend.wealth.openapi.model.ExecutionInstructionResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class ImExecutionController implements com.backend.wealth.api.im.ExecutionApi {

    private final ExecutionLifecycleService executionLifecycleService;

    @Override
    public ResponseEntity<ExecutionInstructionResponse> createExecutionInstruction(ExecutionInstructionCreateRequest executionInstructionCreateRequest) {
        ExecutionInstructionResponse body = executionLifecycleService.createInstruction(executionInstructionCreateRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }
}
