package com.backend.wealth.discovery.support;

import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Map;

public final class FieldDictionaryCsvRowMapper {

    private FieldDictionaryCsvRowMapper() {
    }

    public record ParsedRow(
            String systemFieldName,
            Integer rowNo,
            String dataDomain,
            String dataItem,
            String detailFieldGroup,
            Integer detailFieldNo,
            String detailFieldName,
            String fieldDescription,
            String dataType,
            String mandatoryLevel,
            String appliesTo,
            String suggestedSource,
            String validationRule,
            String usedFor,
            String sensitivity,
            String updateFrequency,
            String missingDataAction,
            String exampleValue,
            String notes
    ) {
    }

    public static ParsedRow parse(Map<String, String> row) {
        String systemField = DiscoveryCsvParser.get(
                row,
                "system field name",
                "system_field_name",
                "system field"
        );
        return new ParsedRow(
                emptyToNull(systemField),
                parseInt(DiscoveryCsvParser.get(row, "row no.", "row no", "row_no")),
                emptyToNull(DiscoveryCsvParser.get(row, "data domain", "data_domain")),
                emptyToNull(DiscoveryCsvParser.get(row, "data item", "data_item")),
                emptyToNull(DiscoveryCsvParser.get(row, "detail field group", "detail_field_group")),
                parseInt(DiscoveryCsvParser.get(row, "detail field no.", "detail field no", "detail_field_no")),
                emptyToNull(DiscoveryCsvParser.get(row, "detail field name", "detail_field_name")),
                emptyToNull(DiscoveryCsvParser.get(row, "field description", "field_description")),
                emptyToNull(DiscoveryCsvParser.get(row, "data type", "data_type")),
                emptyToNull(DiscoveryCsvParser.get(row, "mandatory level", "mandatory_level")),
                emptyToNull(DiscoveryCsvParser.get(row, "applies to", "applies_to")),
                emptyToNull(DiscoveryCsvParser.get(row, "suggested source", "suggested_source")),
                emptyToNull(DiscoveryCsvParser.get(row, "validation rule", "validation_rule")),
                emptyToNull(DiscoveryCsvParser.get(row, "used for", "used_for")),
                emptyToNull(DiscoveryCsvParser.get(row, "sensitivity")),
                emptyToNull(DiscoveryCsvParser.get(row, "update frequency", "update_frequency")),
                emptyToNull(DiscoveryCsvParser.get(row, "missing data action", "missing_data_action")),
                emptyToNull(DiscoveryCsvParser.get(row, "example value", "example_value")),
                emptyToNull(DiscoveryCsvParser.get(row, "notes"))
        );
    }

    private static String emptyToNull(String value) {
        return StringUtils.hasText(value) ? value.trim() : null;
    }

    private static Integer parseInt(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    public static String truncate(String value, int maxLen) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        if (trimmed.length() <= maxLen) {
            return trimmed;
        }
        return trimmed.substring(0, maxLen);
    }
}
