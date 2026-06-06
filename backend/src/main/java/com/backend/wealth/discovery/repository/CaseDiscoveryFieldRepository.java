package com.backend.wealth.discovery.repository;

import com.backend.wealth.discovery.model.CaseDiscoveryField;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface CaseDiscoveryFieldRepository extends JpaRepository<CaseDiscoveryField, UUID> {

    @Modifying
    void deleteByWealthCase_Id(UUID caseId);

    Page<CaseDiscoveryField> findByWealthCase_IdOrderBySystemFieldAsc(UUID caseId, Pageable pageable);

    boolean existsBySystemField(String systemField);

    @Query("""
            SELECT cdf FROM CaseDiscoveryField cdf
            WHERE cdf.wealthCase.id = :caseId
              AND (:status IS NULL OR cdf.status = :status)
            ORDER BY cdf.systemField ASC
            """)
    Page<CaseDiscoveryField> findByCaseAndStatus(
            @Param("caseId") UUID caseId,
            @Param("status") String status,
            Pageable pageable
    );

    long countByWealthCase_IdAndStatus(UUID caseId, String status);

    @Query("""
            SELECT COUNT(fd) FROM FieldDictionary fd
            WHERE fd.mandatoryLevel = 'Mandatory'
              AND NOT EXISTS (
                SELECT 1 FROM CaseDiscoveryField cdf
                WHERE cdf.wealthCase.id = :caseId
                  AND cdf.systemField = fd.systemFieldName
                  AND cdf.status = 'filled'
              )
            """)
    long countMissingMandatoryFields(@Param("caseId") UUID caseId);

    @Query("""
            SELECT COUNT(fd) FROM FieldDictionary fd
            WHERE fd.mandatoryLevel = 'Mandatory'
              AND EXISTS (
                SELECT 1 FROM CaseDiscoveryField cdf
                WHERE cdf.wealthCase.id = :caseId
                  AND cdf.systemField = fd.systemFieldName
                  AND cdf.status = 'filled'
              )
            """)
    long countFilledMandatoryFields(@Param("caseId") UUID caseId);

    @Query("""
            SELECT cdf FROM CaseDiscoveryField cdf
            LEFT JOIN FieldDictionary fd ON fd.systemFieldName = cdf.systemField
            WHERE cdf.wealthCase.id = :caseId
              AND cdf.status = 'filled'
              AND (:dataDomainPattern IS NULL OR LOWER(fd.dataDomain) LIKE :dataDomainPattern)
            ORDER BY fd.rowNo ASC NULLS LAST, cdf.systemField ASC
            """)
    Page<CaseDiscoveryField> findFilledByCaseAndDomain(
            @Param("caseId") UUID caseId,
            @Param("dataDomainPattern") String dataDomainPattern,
            Pageable pageable
    );

    long countByWealthCase_Id(UUID caseId);
}
