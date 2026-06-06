package com.backend.wealth.invitation.service;

import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.exception.NotFoundException;
import com.backend.wealth.openapi.model.InvitationRequest;
import com.backend.wealth.openapi.model.InvitationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
@RequiredArgsConstructor
public class InvitationService {

    private final ClientRepository clientRepository;

    public InvitationResponse sendInvitation(InvitationRequest request) {
        UUID clientId = request.getClientId();
        if (clientId != null && !clientRepository.existsById(clientId)) {
            throw new NotFoundException("Client not found: " + clientId);
        }
        InvitationResponse response = new InvitationResponse();
        response.setAccepted(Boolean.TRUE);
        response.setMessage("Invitation stub — core state unchanged.");
        return response;
    }
}
