package com.backend.wealth.client.service;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.constants.ClientStatuses;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.openapi.model.MobileRegisterRequest;
import com.backend.wealth.openapi.model.MobileRegisterResponse;
import com.backend.wealth.task.constants.TaskStatuses;
import com.backend.wealth.task.constants.TaskTypes;
import com.backend.wealth.task.model.Task;
import com.backend.wealth.task.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class MobileRegistrationService {

    private final ClientRepository clientRepository;
    private final WealthCaseRepository wealthCaseRepository;
    private final TaskRepository taskRepository;

    @Transactional
    public MobileRegisterResponse register(MobileRegisterRequest request) {
        Client client = clientRepository.findById(request.getClientId())
                .orElseThrow(() -> new NotFoundException("Client not found: " + request.getClientId()));

        WealthCase wc = wealthCaseRepository.findFirstByClient_IdOrderByCreatedAtAsc(client.getId())
                .orElseThrow(() -> new NotFoundException("Case not found for client: " + client.getId()));

        Task registration = taskRepository.findByWealthCase_IdAndTaskType(wc.getId(), TaskTypes.CLIENT_REGISTRATION)
                .orElseThrow(() -> new NotFoundException("CLIENT_REGISTRATION task not found."));
        registration.setStatus(TaskStatuses.COMPLETED);
        taskRepository.save(registration);

        client.setStatus(ClientStatuses.ACTIVE);
        clientRepository.save(client);

        MobileRegisterResponse response = new MobileRegisterResponse();
        response.setClientId(client.getId());
        response.setStatus(client.getStatus());
        response.setCompletedTask(TaskTypes.CLIENT_REGISTRATION);
        return response;
    }
}
