package com.backend.wealth.discovery.service;

import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.discovery.dto.DiscoverySummaryResponse;
import com.backend.wealth.discovery.dto.DiscoverySummaryResponse.DiscoverySummaryFieldItem;
import com.backend.wealth.discovery.dto.DiscoverySummaryResponse.DiscoverySummaryMissingItem;
import com.backend.wealth.discovery.dto.DiscoverySummaryResponse.DiscoverySummaryStats;
import com.backend.wealth.discovery.dto.UnmappedDiscoveryAnswerResponse;
import com.backend.wealth.discovery.model.CaseDiscoveryField;
import com.backend.wealth.discovery.model.FieldDictionary;
import com.backend.wealth.discovery.repository.CaseDiscoveryFieldRepository;
import com.backend.wealth.discovery.repository.FieldDictionaryRepository;
import com.backend.wealth.discovery.support.FieldDictionaryQueryParams;
import com.backend.wealth.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DiscoverySummaryService {

    private static final String MANDATORY = "Mandatory";
    private static final String STATUS_FILLED = "filled";
    private static final String STATUS_MISSING = "missing";

    private final WealthCaseRepository wealthCaseRepository;
    private final CaseDiscoveryFieldRepository caseDiscoveryFieldRepository;
    private final FieldDictionaryRepository fieldDictionaryRepository;
    private final DiscoveryProjectionService discoveryProjectionService;

    @Transactional(readOnly = true)
    public DiscoverySummaryResponse buildSummary(
            UUID caseId,
            String dataDomain,
            int filledLimit,
            int missingLimit,
            int unmappedLimit
    ) {
        if (!wealthCaseRepository.existsById(caseId)) {
            throw new NotFoundException("case not found: " + caseId);
        }

        int safeFilledLimit = Math.min(Math.max(filledLimit, 0), 200);
        int safeMissingLimit = Math.min(Math.max(missingLimit, 0), 200);
        int safeUnmappedLimit = Math.min(Math.max(unmappedLimit, 0), 50);

        String domainFilter = StringUtils.hasText(dataDomain) ? dataDomain.trim() : null;

        long mandatoryTotal = fieldDictionaryRepository.countByMandatoryLevel(MANDATORY);
        long mandatoryFilled = caseDiscoveryFieldRepository.countFilledMandatoryFields(caseId);
        long mandatoryMissing = caseDiscoveryFieldRepository.countMissingMandatoryFields(caseId);

        int materialized = (int) caseDiscoveryFieldRepository.countByWealthCase_Id(caseId);
        int filledCount = (int) caseDiscoveryFieldRepository.countByWealthCase_IdAndStatus(caseId, STATUS_FILLED);
        int missingMaterialized = (int) caseDiscoveryFieldRepository.countByWealthCase_IdAndStatus(caseId, STATUS_MISSING);

        List<DiscoverySummaryFieldItem> filledFields = loadFilledSlice(caseId, domainFilter, safeFilledLimit);
        List<DiscoverySummaryMissingItem> missingMandatory =
                loadMissingMandatorySlice(caseId, domainFilter, safeMissingLimit);

        List<UnmappedDiscoveryAnswerResponse> unmapped =
                discoveryProjectionService.collectUnmappedForSummary(caseId, safeUnmappedLimit);

        Map<String, Long> filledByDomain = loadFilledCountByDomain(caseId);

        DiscoverySummaryStats stats = new DiscoverySummaryStats(
                materialized,
                filledCount,
                missingMaterialized,
                mandatoryTotal,
                mandatoryFilled,
                mandatoryMissing,
                unmapped.size()
        );

        return new DiscoverySummaryResponse(
                caseId,
                stats,
                filledFields,
                missingMandatory,
                unmapped,
                filledByDomain
        );
    }

    private List<DiscoverySummaryFieldItem> loadFilledSlice(UUID caseId, String domainFilter, int limit) {
        if (limit <= 0) {
            return List.of();
        }
        Page<CaseDiscoveryField> page = caseDiscoveryFieldRepository.findFilledByCaseAndDomain(
                caseId,
                FieldDictionaryQueryParams.likePattern(domainFilter),
                PageRequest.of(0, limit)
        );
        List<String> fields = page.getContent().stream()
                .map(CaseDiscoveryField::getSystemField)
                .toList();
        Map<String, FieldDictionary> dict = fieldDictionaryRepository.findAllById(fields).stream()
                .collect(Collectors.toMap(FieldDictionary::getSystemFieldName, f -> f, (a, b) -> a));

        List<DiscoverySummaryFieldItem> out = new ArrayList<>();
        for (CaseDiscoveryField row : page.getContent()) {
            FieldDictionary fd = dict.get(row.getSystemField());
            out.add(new DiscoverySummaryFieldItem(
                    row.getSystemField(),
                    row.getValueText(),
                    fd != null ? fd.getDataDomain() : null,
                    fd != null ? fd.getDataItem() : null,
                    fd != null ? fd.getDetailFieldName() : null,
                    row.getQuestionId(),
                    row.getBlockIndex()
            ));
        }
        return out;
    }

    private List<DiscoverySummaryMissingItem> loadMissingMandatorySlice(
            UUID caseId,
            String domainFilter,
            int limit
    ) {
        if (limit <= 0) {
            return List.of();
        }
        Page<FieldDictionary> page = fieldDictionaryRepository.findMissingMandatoryForCase(
                caseId,
                FieldDictionaryQueryParams.likePattern(domainFilter),
                PageRequest.of(0, limit)
        );
        return page.getContent().stream()
                .map(fd -> new DiscoverySummaryMissingItem(
                        fd.getSystemFieldName(),
                        fd.getDataDomain(),
                        fd.getDataItem(),
                        fd.getDetailFieldName(),
                        fd.getMandatoryLevel()
                ))
                .toList();
    }

    private Map<String, Long> loadFilledCountByDomain(UUID caseId) {
        Page<CaseDiscoveryField> allFilled = caseDiscoveryFieldRepository.findByCaseAndStatus(
                caseId,
                STATUS_FILLED,
                PageRequest.of(0, 5000)
        );
        List<String> fields = allFilled.getContent().stream()
                .map(CaseDiscoveryField::getSystemField)
                .toList();
        Map<String, FieldDictionary> dict = fieldDictionaryRepository.findAllById(fields).stream()
                .collect(Collectors.toMap(FieldDictionary::getSystemFieldName, f -> f, (a, b) -> a));

        Map<String, Long> counts = new LinkedHashMap<>();
        for (CaseDiscoveryField row : allFilled.getContent()) {
            FieldDictionary fd = dict.get(row.getSystemField());
            String domain = fd != null && StringUtils.hasText(fd.getDataDomain())
                    ? fd.getDataDomain()
                    : "Unknown";
            counts.merge(domain, 1L, Long::sum);
        }
        return counts;
    }
}
