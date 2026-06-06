package com.backend.wealth.admin.controller;

import com.backend.wealth.execution.service.ExecutionLifecycleService;
import com.backend.wealth.openapi.model.ExecutionInstructionResponse;
import com.backend.wealth.openapi.model.ExecutionResultRequest;
import com.backend.wealth.openapi.model.ExecutionResultResponse;
import com.backend.wealth.openapi.model.ExecutionSendRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class AdminExecutionController implements com.backend.wealth.api.admin.ExecutionApi {

    private final ExecutionLifecycleService executionLifecycleService;

    @Override
    public ResponseEntity<ExecutionInstructionResponse> sendExecutionInstruction(ExecutionSendRequest executionSendRequest) {
        return ResponseEntity.ok(executionLifecycleService.sendInstruction(executionSendRequest));
    }

    @Override
    public ResponseEntity<ExecutionResultResponse> recordExecutionResults(ExecutionResultRequest executionResultRequest) {
        return ResponseEntity.ok(executionLifecycleService.recordResults(executionResultRequest));
    }
}
