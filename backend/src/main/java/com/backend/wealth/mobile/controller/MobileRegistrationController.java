package com.backend.wealth.mobile.controller;

import com.backend.wealth.api.clientdata.MobileApi;
import com.backend.wealth.client.service.MobileRegistrationService;
import com.backend.wealth.openapi.model.MobileRegisterRequest;
import com.backend.wealth.openapi.model.MobileRegisterResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequiredArgsConstructor
public class MobileRegistrationController implements MobileApi {

    private final MobileRegistrationService mobileRegistrationService;

    @Override
    public ResponseEntity<MobileRegisterResponse> mobileRegister(MobileRegisterRequest mobileRegisterRequest) {
        return ResponseEntity.ok(mobileRegistrationService.register(mobileRegisterRequest));
    }
}
