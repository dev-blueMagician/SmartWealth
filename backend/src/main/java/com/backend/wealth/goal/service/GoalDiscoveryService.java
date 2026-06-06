package com.backend.wealth.goal.service;

import com.backend.wealth.client.model.Client;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.goal.model.Goal;
import com.backend.wealth.goal.repository.GoalRepository;
import com.backend.wealth.openapi.model.DiscoveryGoalRequest;
import com.backend.wealth.openapi.model.DiscoveryGoalResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class GoalDiscoveryService {

    private final GoalRepository goalRepository;
    private final ClientRepository clientRepository;

    @Transactional(readOnly = true)
    public List<DiscoveryGoalResponse> listGoals(UUID clientId) {
        if (!clientRepository.existsById(clientId)) {
            throw new NotFoundException("Client not found: " + clientId);
        }
        return goalRepository.findByClient_Id(clientId).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public DiscoveryGoalResponse createGoal(UUID clientId, DiscoveryGoalRequest request) {
        Client client = clientRepository.findById(clientId)
                .orElseThrow(() -> new NotFoundException("Client not found: " + clientId));
        Goal goal = Goal.builder()
                .client(client)
                .goalType(request.getGoalType())
                .targetAmount(request.getTargetAmount())
                .build();
        goalRepository.save(goal);

        DiscoveryGoalResponse response = new DiscoveryGoalResponse();
        response.setId(goal.getId());
        response.setClientId(client.getId());
        response.setGoalType(goal.getGoalType());
        response.setTargetAmount(goal.getTargetAmount());
        return response;
    }

    private DiscoveryGoalResponse toResponse(Goal goal) {
        DiscoveryGoalResponse response = new DiscoveryGoalResponse();
        response.setId(goal.getId());
        response.setClientId(goal.getClient().getId());
        response.setGoalType(goal.getGoalType());
        response.setTargetAmount(goal.getTargetAmount());
        return response;
    }
}
