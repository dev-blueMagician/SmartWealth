package com.backend.wealth.execution.repository;

import com.backend.wealth.execution.model.ExecutionInstruction;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

public interface ExecutionInstructionRepository extends JpaRepository<ExecutionInstruction, UUID> {

    @Query(
            "SELECT ei FROM ExecutionInstruction ei "
                    + "JOIN ei.recommendation r JOIN r.plan p "
                    + "WHERE p.client.id = :clientId "
                    + "ORDER BY ei.createdAt DESC"
    )
    List<ExecutionInstruction> findByPlanClientId(@Param("clientId") UUID clientId);
}
