package com.backend.wealth.bootstrap;

import com.backend.wealth.auth.config.WealthSecurityProperties;
import com.backend.wealth.identity.entity.AppRole;
import com.backend.wealth.identity.entity.AppUser;
import com.backend.wealth.identity.repository.AppRoleRepository;
import com.backend.wealth.identity.repository.AppUserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
@RequiredArgsConstructor
@Slf4j
public class IdentityBootstrap implements CommandLineRunner {

    private static final List<String> ROLE_CODES = List.of("RM", "WM", "IM", "ADMIN", "CLIENT");

    private final AppRoleRepository appRoleRepository;
    private final AppUserRepository appUserRepository;
    private final PasswordEncoder passwordEncoder;
    private final WealthSecurityProperties securityProperties;

    @Override
    public void run(String... args) {
        for (String code : ROLE_CODES) {
            appRoleRepository.findByCode(code).orElseGet(() -> appRoleRepository.save(new AppRole(code)));
        }
        String adminUser = securityProperties.getBootstrapAdminUsername();
        String adminPass = securityProperties.getBootstrapAdminPassword();
        if (adminUser == null || adminUser.isBlank() || adminPass == null || adminPass.isBlank()) {
            log.warn("Bootstrap admin skipped: set wealth.security.bootstrap-admin-username/password");
            return;
        }
        if (appUserRepository.existsByUsernameIgnoreCase(adminUser)) {
            return;
        }
        AppRole adminRole = appRoleRepository.findByCode("ADMIN")
                .orElseThrow(() -> new IllegalStateException("ADMIN role missing"));
        AppUser user = new AppUser();
        user.setUsername(adminUser.trim());
        user.setPasswordHash(passwordEncoder.encode(adminPass));
        user.setEmail(null);
        user.setEnabled(true);
        user.getRoles().add(adminRole);
        appUserRepository.save(user);
        log.info("Bootstrap admin user '{}' created (change password in production).", adminUser);
    }
}
