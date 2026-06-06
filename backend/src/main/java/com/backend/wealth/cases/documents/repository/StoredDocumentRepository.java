package com.backend.wealth.cases.documents.repository;

import com.backend.wealth.cases.documents.model.StoredDocument;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface StoredDocumentRepository extends JpaRepository<StoredDocument, UUID> {
}
