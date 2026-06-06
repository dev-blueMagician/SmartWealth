package com.backend.wealth.cases.chat.repository;

import com.backend.wealth.cases.chat.model.CaseChatThread;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface CaseChatThreadRepository extends JpaRepository<CaseChatThread, UUID> {

    Optional<CaseChatThread> findByWealthCase_IdAndChannel(UUID caseId, String channel);
}
