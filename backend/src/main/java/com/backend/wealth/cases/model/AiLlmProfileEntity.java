package com.backend.wealth.cases.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "ai_llm_profile")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AiLlmProfileEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "code", length = 64, nullable = false, unique = true)
    private String code;

    @Column(name = "display_name", length = 200, nullable = false)
    private String displayName;

    /** deepseek | azure_openai */
    @Column(name = "llm_provider", length = 32, nullable = false)
    private String llmProvider;

    @Column(name = "deepseek_base_url", length = 512)
    private String deepseekBaseUrl;

    @Column(name = "deepseek_model", length = 128)
    private String deepseekModel;

    @Column(name = "deepseek_api_key", columnDefinition = "text")
    private String deepseekApiKey;

    @Column(name = "azure_openai_endpoint", length = 512)
    private String azureOpenaiEndpoint;

    @Column(name = "azure_openai_deployment", length = 128)
    private String azureOpenaiDeployment;

    @Column(name = "azure_openai_api_version", length = 64)
    private String azureOpenaiApiVersion;

    @Column(name = "azure_openai_api_key", columnDefinition = "text")
    private String azureOpenaiApiKey;

    @Column(name = "assessment_llm_enabled", nullable = false)
    private Boolean assessmentLlmEnabled;

    @Column(name = "completeness_loop_graph_enabled", nullable = false)
    private Boolean completenessLoopGraphEnabled;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;
}
