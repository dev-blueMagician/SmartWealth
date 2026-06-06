package com.backend.wealth.admin.users;

import com.backend.wealth.admin.users.dto.CreateUserRequest;
import com.backend.wealth.admin.users.dto.UpdateUserRequest;
import com.backend.wealth.admin.users.dto.UserSummaryResponse;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin/users")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminUserController {

    private final AdminUserService adminUserService;

    @GetMapping
    public List<UserSummaryResponse> list() {
        return adminUserService.listUsers();
    }

    @GetMapping("/{id}")
    public UserSummaryResponse get(@PathVariable UUID id) {
        return adminUserService.getUser(id);
    }

    @PostMapping
    public ResponseEntity<UserSummaryResponse> create(@Valid @RequestBody CreateUserRequest request) {
        UserSummaryResponse body = adminUserService.create(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(body);
    }

    @PatchMapping("/{id}")
    public UserSummaryResponse update(@PathVariable UUID id, @RequestBody UpdateUserRequest request) {
        return adminUserService.update(id, request);
    }
}
