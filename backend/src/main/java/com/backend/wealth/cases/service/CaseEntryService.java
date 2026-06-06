package com.backend.wealth.cases.service;

import com.backend.wealth.audit.constants.AuditActions;
import com.backend.wealth.audit.constants.AuditEntities;
import com.backend.wealth.audit.model.AuditEvent;
import com.backend.wealth.audit.repository.AuditEventRepository;
import com.backend.wealth.cases.constants.CaseStatuses;
import com.backend.wealth.cases.constants.CaseTypes;
import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.constants.ClientStatuses;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.integration.AiEngineWorkflowClient;
import com.backend.wealth.openapi.model.CaseEntryRequest;
import com.backend.wealth.openapi.model.CaseEntryResponse;
import com.backend.wealth.task.constants.TaskStatuses;
import com.backend.wealth.task.constants.TaskTypes;
import com.backend.wealth.task.model.Task;
import com.backend.wealth.task.repository.TaskRepository;
import com.backend.wealth.workflow.model.WorkflowStateEntity;
import com.backend.wealth.workflow.repository.WorkflowStateRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class CaseEntryService {

    private final ClientRepository clientRepository;
    private final WealthCaseRepository wealthCaseRepository;
    private final TaskRepository taskRepository;
    private final AuditEventRepository auditEventRepository;
    private final AiEngineWorkflowClient aiEngineWorkflowClient;
    private final WorkflowStateRepository workflowStateRepository;
    private final CasePhaseService casePhaseService;

    public CaseEntryResponse createCaseEntry(CaseEntryRequest request) {
        String name = request.getClientName() != null && !request.getClientName().isBlank()
                ? request.getClientName()
                : "Pending client";

        Client client = Client.builder()
                .name(name)
                .status(ClientStatuses.AWAITING_ACTIVATION)
                .build();
        clientRepository.save(client);

        Map<String, Object> wfPayload = new LinkedHashMap<>();
        wfPayload.put("client_id", client.getId().toString());
        wfPayload.put("case_type", CaseTypes.ONBOARDING);
        wfPayload.put("phase", "CASE_CREATED");
        if (request.getRmNote() != null && !request.getRmNote().isBlank()) {
            wfPayload.put("rm_note", request.getRmNote());
        }

        String workflowId;
        try {
            workflowId = aiEngineWorkflowClient.createWorkflowWithRetries(wfPayload);
        } catch (RuntimeException ex) {
            clientRepository.delete(client);
            throw ex;
        }

        WealthCase wc = WealthCase.builder()
                .client(client)
                .type(CaseTypes.ONBOARDING)
                .status(CaseStatuses.IN_PROGRESS)
                .phase(casePhaseService.requireEnabledPhaseCode("ONBOARDING"))
                .build();
        wealthCaseRepository.save(wc);
        upsertWorkflowState(workflowId, wc.getId(), wfPayload);

        Task registrationTask = Task.builder()
                .wealthCase(wc)
                .taskType(TaskTypes.CLIENT_REGISTRATION)
                .status(TaskStatuses.PENDING)
                .build();
        Task profileTask = Task.builder()
                .wealthCase(wc)
                .taskType(TaskTypes.PROFILE_COMPLETION)
                .status(TaskStatuses.PENDING)
                .build();
        taskRepository.save(registrationTask);
        taskRepository.save(profileTask);

        AuditEvent audit = AuditEvent.builder()
                .entityName(AuditEntities.CASE)
                .action(AuditActions.CASE_CREATED)
                .build();
        auditEventRepository.save(audit);

        CaseEntryResponse response = new CaseEntryResponse();
        response.setClientId(client.getId());
        response.setCaseId(wc.getId());
        response.setOnboardingTaskId(registrationTask.getId());
        response.setProfileCompletionTaskId(profileTask.getId());
        response.setAuditEventId(audit.getId());
        response.setWorkflowId(workflowId);
        return response;
    }

    private void upsertWorkflowState(String workflowId, java.util.UUID caseId, Map<String, Object> inputPayload) {
        WorkflowStateEntity state = workflowStateRepository.findById(workflowId)
                .orElseGet(() -> WorkflowStateEntity.builder()
                        .workflowId(workflowId)
                        .status("RECEIVED")
                        .inputPayload(inputPayload)
                        .version(1)
                        .updatedAt(OffsetDateTime.now())
                        .build());
        state.setCaseId(caseId);
        if (state.getInputPayload() == null) {
            state.setInputPayload(inputPayload);
        }
        workflowStateRepository.save(state);
    }
}
