package com.backend.wealth.auth.web;

import com.backend.wealth.auth.jwt.JwtService;
import com.backend.wealth.auth.web.dto.LoginRequest;
import com.backend.wealth.auth.web.dto.LoginResponse;
import com.backend.wealth.auth.web.dto.MeResponse;
import com.backend.wealth.identity.entity.AppUser;
import com.backend.wealth.identity.repository.AppUserRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final AppUserRepository appUserRepository;

    @PostMapping("/api/auth/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username().trim(), request.password()));
        SecurityContextHolder.getContext().setAuthentication(authentication);
        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        AppUser user = appUserRepository.findByUsernameIgnoreCase(userDetails.getUsername())
                .orElseThrow();
        List<String> roleCodes = user.getRoles().stream().map(r -> r.getCode()).sorted().toList();
        String token = jwtService.generateAccessToken(userDetails, user.getId(), roleCodes);
        return ResponseEntity.ok(new LoginResponse(
                token,
                "Bearer",
                user.getId(),
                user.getUsername(),
                roleCodes
        ));
    }

    @GetMapping("/api/auth/me")
    public ResponseEntity<MeResponse> me() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            return ResponseEntity.status(401).build();
        }
        String username = authentication.getName();
        AppUser user = appUserRepository.findByUsernameIgnoreCase(username)
                .orElseThrow();
        List<String> roleCodes = user.getRoles().stream().map(r -> r.getCode()).sorted().toList();
        return ResponseEntity.ok(new MeResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                roleCodes
        ));
    }
}
