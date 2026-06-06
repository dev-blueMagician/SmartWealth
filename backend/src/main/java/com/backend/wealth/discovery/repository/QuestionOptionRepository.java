package com.backend.wealth.discovery.repository;

import com.backend.wealth.discovery.model.QuestionOption;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface QuestionOptionRepository extends JpaRepository<QuestionOption, UUID> {

    List<QuestionOption> findByQuestion_QuestionIdOrderByOptionLabelAsc(String questionId);

    boolean existsByQuestion_QuestionIdAndOptionValue(String questionId, String optionValue);
}
