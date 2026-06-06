package com.backend.wealth.cases.documents.repository;

import com.backend.wealth.cases.documents.model.CaseDocument;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

public interface CaseDocumentRepository extends JpaRepository<CaseDocument, UUID> {

    @EntityGraph(attributePaths = {"document"})
    List<CaseDocument> findAllByWealthCase_IdAndIdIn(UUID caseId, Collection<UUID> ids);

    @EntityGraph(attributePaths = {"document"})
    List<CaseDocument> findAllByWealthCase_IdAndStatus(UUID caseId, String status);

    @EntityGraph(attributePaths = {"document"})
    List<CaseDocument> findAllByWealthCase_IdOrderByCreatedAtDesc(UUID caseId);
}
