package com.backend.wealth.cases.chat.repository;

import com.backend.wealth.cases.chat.model.CaseChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface CaseChatMessageRepository extends JpaRepository<CaseChatMessage, UUID> {

    List<CaseChatMessage> findByThread_IdOrderByCreatedAtAsc(UUID threadId);

    List<CaseChatMessage> findByThread_IdOrderByCreatedAtDesc(UUID threadId, Pageable pageable);

    long deleteByThread_Id(UUID threadId);
}
