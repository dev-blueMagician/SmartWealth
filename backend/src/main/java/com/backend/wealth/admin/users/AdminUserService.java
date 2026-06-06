package com.backend.wealth.admin.users;

import com.backend.wealth.admin.users.dto.CreateUserRequest;
import com.backend.wealth.admin.users.dto.UpdateUserRequest;
import com.backend.wealth.admin.users.dto.UserSummaryResponse;
import com.backend.wealth.client.repository.ClientRepository;
import com.backend.wealth.identity.entity.AppRole;
import com.backend.wealth.identity.entity.AppUser;
import com.backend.wealth.identity.repository.AppRoleRepository;
import com.backend.wealth.identity.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
@Service
@RequiredArgsConstructor
public class AdminUserService {

    private final AppUserRepository appUserRepository;
    private final AppRoleRepository appRoleRepository;
    private final ClientRepository clientRepository;
    private final PasswordEncoder passwordEncoder;

    @Transactional(readOnly = true)
    public List<UserSummaryResponse> listUsers() {
        return appUserRepository.findAll().stream()
                .sorted((a, b) -> a.getUsername().compareToIgnoreCase(b.getUsername()))
                .map(this::toSummary)
                .toList();
    }

    @Transactional(readOnly = true)
    public UserSummaryResponse getUser(UUID id) {
        AppUser user = appUserRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return toSummary(user);
    }

    @Transactional
    public UserSummaryResponse create(CreateUserRequest request) {
        if (appUserRepository.existsByUsernameIgnoreCase(request.username())) {
            throw new IllegalArgumentException("Username already exists.");
        }
        Set<AppRole> roles = resolveRoles(request.roles());
        validateClientBinding(roles, request.clientId());
        AppUser user = new AppUser();
        user.setUsername(request.username().trim());
        user.setPasswordHash(passwordEncoder.encode(request.password()));
        user.setEmail(blankToNull(request.email()));
        user.setEnabled(true);
        user.setClientId(resolveClientIdForPersist(roles, request.clientId()));
        user.setRoles(roles);
        appUserRepository.save(user);
        return toSummary(user);
    }

    @Transactional
    public UserSummaryResponse update(UUID id, UpdateUserRequest request) {
        AppUser user = appUserRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        if (request.enabled() != null) {
            if (!request.enabled()) {
                assertCanDisableAdmin(user);
            }
            user.setEnabled(request.enabled());
        }
        if (request.roles() != null) {
            if (request.roles().isEmpty()) {
                throw new IllegalArgumentException("roles cannot be empty when provided.");
            }
            Set<AppRole> roles = resolveRoles(request.roles());
            assertAdminSurvival(user, roles);
            user.setRoles(roles);
            if (!roles.stream().anyMatch(r -> "CLIENT".equals(r.getCode()))) {
                user.setClientId(null);
            }
        }
        if (request.email() != null) {
            user.setEmail(blankToNull(request.email()));
        }
        if (request.password() != null && !request.password().isBlank()) {
            user.setPasswordHash(passwordEncoder.encode(request.password()));
        }
        if (request.clientId() != null) {
            user.setClientId(request.clientId());
        }
        validateClientBinding(user.getRoles(), user.getClientId());
        user.setClientId(resolveClientIdForPersist(user.getRoles(), user.getClientId()));
        return toSummary(appUserRepository.save(user));
    }

    private void assertCanDisableAdmin(AppUser user) {
        boolean isAdmin = user.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getCode()));
        if (!isAdmin) {
            return;
        }
        long otherActiveAdmins = appUserRepository.findAll().stream()
                .filter(AppUser::isEnabled)
                .filter(u -> !u.getId().equals(user.getId()))
                .filter(u -> u.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getCode())))
                .count();
        if (otherActiveAdmins == 0) {
            throw new IllegalArgumentException("Cannot disable the last active administrator.");
        }
    }

    private void assertAdminSurvival(AppUser user, Set<AppRole> newRoles) {
        boolean wasAdmin = user.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getCode()));
        boolean stillAdmin = newRoles.stream().anyMatch(r -> "ADMIN".equals(r.getCode()));
        if (wasAdmin && !stillAdmin) {
            long otherAdmins = appUserRepository.findAll().stream()
                    .filter(u -> !u.getId().equals(user.getId()))
                    .filter(u -> u.getRoles().stream().anyMatch(r -> "ADMIN".equals(r.getCode())))
                    .count();
            if (otherAdmins == 0) {
                throw new IllegalArgumentException("Cannot remove ADMIN from the last administrator account.");
            }
        }
    }

    private void validateClientBinding(Set<AppRole> roles, UUID clientId) {
        boolean needsClient = roles.stream().anyMatch(r -> "CLIENT".equals(r.getCode()));
        if (needsClient && clientId == null) {
            throw new IllegalArgumentException("clientId is required when role CLIENT is assigned.");
        }
        if (!needsClient || clientId == null) {
            return;
        }
        if (!clientRepository.existsById(clientId)) {
            throw new IllegalArgumentException(
                    "No wealth client exists for clientId " + clientId
                            + ". Create a case first so the client row exists, then link this user.");
        }
    }

    /** Persist client_id only when CLIENT role is present; avoids FK violations for staff-only users. */
    private UUID resolveClientIdForPersist(Set<AppRole> roles, UUID clientId) {
        boolean needsClient = roles.stream().anyMatch(r -> "CLIENT".equals(r.getCode()));
        return needsClient ? clientId : null;
    }

    private Set<AppRole> resolveRoles(List<String> codes) {
        Set<AppRole> set = new HashSet<>();
        for (String raw : codes) {
            if (raw == null || raw.isBlank()) {
                continue;
            }
            String code = raw.trim().toUpperCase();
            AppRole role = appRoleRepository.findByCode(code)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + code));
            set.add(role);
        }
        if (set.isEmpty()) {
            throw new IllegalArgumentException("At least one role is required.");
        }
        return set;
    }

    private UserSummaryResponse toSummary(AppUser user) {
        List<String> roles = user.getRoles().stream()
                .map(AppRole::getCode)
                .sorted()
                .toList();
        return new UserSummaryResponse(
                user.getId(),
                user.getUsername(),
                user.getEmail(),
                user.isEnabled(),
                roles,
                user.getClientId()
        );
    }

    private static String blankToNull(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        return s.trim();
    }
}
