package com.backend.wealth.rm.controller;

import com.backend.wealth.api.rm.ApiApi;
import com.backend.wealth.cases.service.CaseEntryService;
import com.backend.wealth.invitation.service.InvitationService;
import com.backend.wealth.openapi.model.CaseEntryRequest;
import com.backend.wealth.openapi.model.CaseEntryResponse;
import com.backend.wealth.openapi.model.InvitationRequest;
import com.backend.wealth.openapi.model.InvitationResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class RmEntryController implements ApiApi {

    private final CaseEntryService caseEntryService;
    private final InvitationService invitationService;

    @Override
    public ResponseEntity<CaseEntryResponse> createCaseEntry(CaseEntryRequest caseEntryRequest) {
        CaseEntryResponse body = caseEntryService.createCaseEntry(caseEntryRequest);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @Override
    public ResponseEntity<InvitationResponse> sendInvitation(InvitationRequest invitationRequest) {
        InvitationResponse body = invitationService.sendInvitation(invitationRequest);
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(body);
    }
}
