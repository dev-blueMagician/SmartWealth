package com.backend.wealth.discovery.repository;

import com.backend.wealth.discovery.model.FieldDictionary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.UUID;

public interface FieldDictionaryRepository extends JpaRepository<FieldDictionary, String> {

    @Query("""
            SELECT f FROM FieldDictionary f
            WHERE (:dataDomainPattern IS NULL OR LOWER(f.dataDomain) LIKE :dataDomainPattern)
              AND (:mandatoryNorm IS NULL OR LOWER(f.mandatoryLevel) = :mandatoryNorm)
              AND (
                :searchPattern IS NULL
                OR LOWER(f.systemFieldName) LIKE :searchPattern
                OR LOWER(f.dataDomain) LIKE :searchPattern
                OR LOWER(f.dataItem) LIKE :searchPattern
                OR LOWER(f.detailFieldName) LIKE :searchPattern
              )
            ORDER BY f.rowNo ASC NULLS LAST, f.systemFieldName ASC
            """)
    Page<FieldDictionary> search(
            @Param("dataDomainPattern") String dataDomainPattern,
            @Param("mandatoryNorm") String mandatoryNorm,
            @Param("searchPattern") String searchPattern,
            Pageable pageable
    );

    long countByMandatoryLevel(String mandatoryLevel);

    @Query("""
            SELECT fd FROM FieldDictionary fd
            WHERE fd.mandatoryLevel = 'Mandatory'
              AND (:dataDomainPattern IS NULL OR LOWER(fd.dataDomain) LIKE :dataDomainPattern)
              AND NOT EXISTS (
                SELECT 1 FROM CaseDiscoveryField cdf
                WHERE cdf.wealthCase.id = :caseId
                  AND cdf.systemField = fd.systemFieldName
                  AND cdf.status = 'filled'
              )
            ORDER BY fd.rowNo ASC NULLS LAST, fd.systemFieldName ASC
            """)
    Page<FieldDictionary> findMissingMandatoryForCase(
            @Param("caseId") UUID caseId,
            @Param("dataDomainPattern") String dataDomainPattern,
            Pageable pageable
    );
}
