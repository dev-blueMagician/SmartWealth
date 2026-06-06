package com.backend.wealth.discovery.repository;

import com.backend.wealth.discovery.model.QuestionFieldMapping;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface QuestionFieldMappingRepository extends JpaRepository<QuestionFieldMapping, UUID> {

    List<QuestionFieldMapping> findAllByOrderByQuestion_QuestionIdAscSystemFieldAsc();

    boolean existsByQuestion_QuestionIdAndSystemField(String questionId, String systemField);

    List<QuestionFieldMapping> findByQuestion_QuestionId(String questionId);

    boolean existsBySystemField(String systemField);
}
