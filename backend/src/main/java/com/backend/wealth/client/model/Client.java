package com.backend.wealth.client.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "client")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Client {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(length = 255)
    private String name;

    @Column(name = "status", length = 50, nullable = false)
    private String status;

    @Column(name = "risk_profile", length = 50)
    private String riskProfile;

    @Column(length = 50)
    private String residency;

    @Column(name = "date_of_birth")
    private LocalDate dateOfBirth;

    @Column(name = "marital_status", length = 32)
    private String maritalStatus;

    @Column(length = 64)
    private String nationality;

    @Column(name = "primary_phone", length = 64)
    private String primaryPhone;

    @Column(name = "primary_email", length = 255)
    private String primaryEmail;

    @Column(name = "contact_address", columnDefinition = "TEXT")
    private String contactAddress;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}
