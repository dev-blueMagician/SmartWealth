package com.backend.wealth.auth.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;

@Getter
@Setter
@ConfigurationProperties(prefix = "wealth.security")
public class WealthSecurityProperties {

    /**
     * HS256 secret; must be at least 256 bits (32 chars) for jjwt Keys.hmacShaKeyFor.
     */
    private String jwtSecret = "";

    private long jwtExpirationMs = 86_400_000L;

    private String bootstrapAdminUsername = "admin";

    private String bootstrapAdminPassword = "changeme";
}
