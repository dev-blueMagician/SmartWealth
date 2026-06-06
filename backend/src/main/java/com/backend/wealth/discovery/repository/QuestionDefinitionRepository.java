package com.backend.wealth.discovery.repository;

import com.backend.wealth.discovery.model.QuestionDefinition;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface QuestionDefinitionRepository extends JpaRepository<QuestionDefinition, String> {

    List<QuestionDefinition> findAllByOrderByQuestionIdAsc();

    List<QuestionDefinition> findByModuleOrderByQuestionIdAsc(String module);

    List<QuestionDefinition> findBySectionOrderByQuestionIdAsc(String section);

    List<QuestionDefinition> findByModuleAndSectionOrderByQuestionIdAsc(String module, String section);
}
