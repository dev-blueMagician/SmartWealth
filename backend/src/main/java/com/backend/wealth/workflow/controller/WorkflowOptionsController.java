package com.backend.wealth.workflow.controller;

import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.client.model.Client;
import com.backend.wealth.client.repository.ClientRepository;
import org.springframework.data.domain.Sort;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@RestController
public class WorkflowOptionsController {

    private final WealthCaseRepository wealthCaseRepository;
    private final ClientRepository clientRepository;

    public WorkflowOptionsController(
            WealthCaseRepository wealthCaseRepository,
            ClientRepository clientRepository
    ) {
        this.wealthCaseRepository = wealthCaseRepository;
        this.clientRepository = clientRepository;
    }

    @GetMapping("/api/workflows/create-options")
    @Transactional(readOnly = true)
    public WorkflowCreateOptionsResponse getWorkflowCreateOptions() {
        List<CaseOption> cases = wealthCaseRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(this::toCaseOption)
                .toList();

        List<ClientOption> clients = clientRepository.findAll(Sort.by(Sort.Direction.DESC, "createdAt"))
                .stream()
                .map(this::toClientOption)
                .toList();

        return new WorkflowCreateOptionsResponse(cases, clients);
    }

    private CaseOption toCaseOption(WealthCase wealthCase) {
        String caseName = buildCaseName(wealthCase);
        return new CaseOption(
                wealthCase.getId(),
                wealthCase.getClient().getId(),
                caseName,
                wealthCase.getClient().getName(),
                wealthCase.getType(),
                wealthCase.getStatus(),
                wealthCase.getCreatedAt()
        );
    }

    private ClientOption toClientOption(Client client) {
        return new ClientOption(
                client.getId(),
                client.getName(),
                client.getStatus(),
                client.getCreatedAt()
        );
    }

    public record WorkflowCreateOptionsResponse(
            List<CaseOption> cases,
            List<ClientOption> clients
    ) {
    }

    public record CaseOption(
            UUID caseId,
            UUID clientId,
            String caseName,
            String clientName,
            String type,
            String status,
            LocalDateTime createdAt
    ) {
    }

    public record ClientOption(
            UUID clientId,
            String clientName,
            String status,
            LocalDateTime createdAt
    ) {
    }

    private String buildCaseName(WealthCase wealthCase) {
        String type = wealthCase.getType() != null ? wealthCase.getType().trim() : "";
        if (!type.isEmpty()) {
            return type;
        }
        return "Case " + wealthCase.getId().toString().substring(0, 8);
    }
}
