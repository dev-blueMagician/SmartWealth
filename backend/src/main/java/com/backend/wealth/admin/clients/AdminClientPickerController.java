package com.backend.wealth.admin.clients;

import com.backend.wealth.admin.clients.dto.AdminClientOptionResponse;
import com.backend.wealth.client.repository.ClientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/clients")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class AdminClientPickerController {

    private final ClientRepository clientRepository;

    @GetMapping
    public List<AdminClientOptionResponse> listForPicker() {
        return clientRepository.findAll(Sort.by(Sort.Direction.ASC, "name")).stream()
                .map(c -> new AdminClientOptionResponse(
                        c.getId(),
                        c.getName(),
                        c.getStatus()))
                .toList();
    }
}
