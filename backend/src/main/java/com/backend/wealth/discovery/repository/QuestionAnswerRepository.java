package com.backend.wealth.discovery.repository;

import com.backend.wealth.discovery.model.QuestionAnswer;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface QuestionAnswerRepository extends JpaRepository<QuestionAnswer, UUID> {

    List<QuestionAnswer> findByWealthCase_IdOrderByQuestion_QuestionIdAscBlockIndexAsc(UUID caseId);

    Optional<QuestionAnswer> findByWealthCase_IdAndQuestion_QuestionIdAndBlockIndex(
            UUID caseId,
            String questionId,
            Integer blockIndex
    );
}
