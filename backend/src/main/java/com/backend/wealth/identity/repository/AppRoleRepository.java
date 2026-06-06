package com.backend.wealth.identity.repository;

import com.backend.wealth.identity.entity.AppRole;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface AppRoleRepository extends JpaRepository<AppRole, UUID> {
    Optional<AppRole> findByCode(String code);
}
