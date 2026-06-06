package com.backend.wealth.task.repository;

import com.backend.wealth.task.model.Task;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;
import java.util.List;

public interface TaskRepository extends JpaRepository<Task, UUID> {

    Optional<Task> findByWealthCase_IdAndTaskType(UUID caseId, String taskType);

    List<Task> findByWealthCase_IdOrderByUpdatedAtDesc(UUID caseId);
}
