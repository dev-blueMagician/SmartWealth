package com.backend.wealth.client.service;

import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.openapi.model.ClientProfileResponse;
import com.backend.wealth.openapi.model.ClientProfileUpdateRequest;
import com.backend.wealth.task.constants.TaskStatuses;
import com.backend.wealth.task.constants.TaskTypes;
import com.backend.wealth.task.model.Task;
import com.backend.wealth.task.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ClientProfileService {

    private final ClientRepository clientRepository;
    private final WealthCaseRepository wealthCaseRepository;
    private final TaskRepository taskRepository;

    @Transactional
    public ClientProfileResponse updateProfile(UUID clientId, ClientProfileUpdateRequest request) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new NotFoundException("Client not found: " + clientId));

        if (request.getName() != null) {
            client.setName(request.getName());
        }
        if (request.getRiskProfile() != null) {
            client.setRiskProfile(request.getRiskProfile());
        }
        if (request.getResidency() != null) {
            client.setResidency(request.getResidency());
        }
        clientRepository.save(client);

        var wc = wealthCaseRepository.findFirstByClient_IdOrderByCreatedAtAsc(clientId)
                .orElseThrow(() -> new NotFoundException("Case not found for client: " + clientId));
        Task profileTask = taskRepository.findByWealthCase_IdAndTaskType(wc.getId(), TaskTypes.PROFILE_COMPLETION)
                .orElseThrow(() -> new NotFoundException("PROFILE_COMPLETION task not found."));
        profileTask.setStatus(TaskStatuses.COMPLETED);
        taskRepository.save(profileTask);

        ClientProfileResponse response = new ClientProfileResponse();
        response.setClientId(client.getId());
        response.setRiskProfile(client.getRiskProfile());
        response.setResidency(client.getResidency());
        response.setCompletedTask(TaskTypes.PROFILE_COMPLETION);
        return response;
    }
}
