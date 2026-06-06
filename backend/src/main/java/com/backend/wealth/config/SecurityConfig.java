package com.backend.wealth.config;

import com.backend.wealth.auth.config.WealthSecurityProperties;
import com.backend.wealth.auth.jwt.JwtAuthenticationFilter;
import com.backend.wealth.auth.security.RestAccessDeniedHandler;
import com.backend.wealth.auth.security.RestAuthenticationEntryPoint;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
@EnableConfigurationProperties(WealthSecurityProperties.class)
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final RestAuthenticationEntryPoint authenticationEntryPoint;
    private final RestAccessDeniedHandler accessDeniedHandler;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration configuration) throws Exception {
        return configuration.getAuthenticationManager();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOriginPatterns(List.of("*"));
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("*"));
        config.setAllowCredentials(false);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        .requestMatchers(
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**"
                        ).permitAll()
                        .requestMatchers(HttpMethod.POST, "/mobile/register").permitAll()
                        .requestMatchers(HttpMethod.PUT, "/clients/*/profile").permitAll()
                        .requestMatchers(HttpMethod.GET, "/clients/*/assets").permitAll()
                        .requestMatchers(HttpMethod.POST, "/clients/*/assets").permitAll()
                        .requestMatchers(HttpMethod.GET, "/clients/*/goals").permitAll()
                        .requestMatchers(HttpMethod.POST, "/clients/*/goals").permitAll()
                        .requestMatchers(HttpMethod.POST, "/recommendations/*/decision").permitAll()

                        .requestMatchers(HttpMethod.POST, "/api/cases").hasAnyRole("RM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/cases/**").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/cases/**").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/invitations").hasAnyRole("RM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/cases").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/cases/**").hasAnyRole("RM", "WM", "IM", "ADMIN")

                        .requestMatchers(HttpMethod.POST, "/cases/*/discovery/check").hasAnyRole("RM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/cases/*/discovery/rebuild")
                        .hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(
                                HttpMethod.GET,
                                "/cases/*/discovery/fields",
                                "/cases/*/discovery/dataset",
                                "/cases/*/discovery/summary"
                        ).hasAnyRole("RM", "WM", "IM", "ADMIN")

                        // Discovery AI assist (uses active ai_llm_profile from DB)
                        .requestMatchers("/discovery/ai/**").hasAnyRole("RM", "WM", "IM", "ADMIN")

                        .requestMatchers(HttpMethod.GET, "/questions", "/questions/**")
                        .hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/questions/import").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/questions/*/options").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/questions").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/questions/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/questions/**").hasRole("ADMIN")

                        .requestMatchers(HttpMethod.GET, "/field-dictionary", "/field-dictionary/**")
                        .hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/field-dictionary").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/field-dictionary/import").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/field-dictionary/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/field-dictionary/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/answers").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/answers").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/mappings", "/mappings/**")
                        .hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/mappings").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/mappings/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/mappings/**").hasRole("ADMIN")

                        .requestMatchers(HttpMethod.POST, "/clients/*/plans").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/clients/*/plans").hasAnyRole("RM", "WM", "IM", "ADMIN")

                        .requestMatchers(HttpMethod.POST, "/plans/*/draft").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/plans/*/recommendations").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/plans/*/recommendations").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/cases/*/planning/drafts").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/cases/*/planning/drafts").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/planning/drafts/*").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/planning/drafts/*/regenerate").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/planning/drafts/*/finalize").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/planning/drafts/*/export").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/planning/artifacts/*/download")
                        .hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/planning/templates").hasAnyRole("WM", "ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/admin/planning/templates").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/admin/planning/templates/*").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/admin/planning/templates").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/admin/planning/templates/*/publish").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/admin/planning/templates/*").hasRole("ADMIN")

                        .requestMatchers(HttpMethod.POST, "/execution/instructions").hasAnyRole("IM", "ADMIN")
                        .requestMatchers(HttpMethod.POST, "/execution/send").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/execution/results").hasRole("ADMIN")

                        .requestMatchers(HttpMethod.GET, "/clients/*/execution/instructions")
                        .hasAnyRole("RM", "WM", "IM", "ADMIN")

                        .requestMatchers("/api/workflows/**").hasAnyRole("RM", "WM", "IM", "ADMIN")
                        .requestMatchers("/api/v1/workflows/**").hasAnyRole("RM", "WM", "IM", "ADMIN")

                        .requestMatchers("/api/admin/users/**").hasRole("ADMIN")
                        .requestMatchers("/api/admin/ai-engine/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/admin/clients").hasRole("ADMIN")

                        .requestMatchers(HttpMethod.GET, "/api/auth/me").authenticated()

                        .anyRequest().denyAll()
                )
                .addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }
}
