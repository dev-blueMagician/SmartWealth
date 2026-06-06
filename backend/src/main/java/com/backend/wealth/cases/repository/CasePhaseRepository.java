package com.backend.wealth.cases.repository;

import com.backend.wealth.cases.model.CasePhaseEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CasePhaseRepository extends JpaRepository<CasePhaseEntity, String> {

    List<CasePhaseEntity> findAllByEnabledTrueOrderBySortOrderAsc();
}
