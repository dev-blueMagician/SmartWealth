package com.backend.wealth.discovery.support;

import org.springframework.util.StringUtils;

import java.util.Locale;

/** Normalizes list/search bind parameters for {@code FieldDictionary} JPQL (avoids PostgreSQL {@code lower(bytea)}). */
public final class FieldDictionaryQueryParams {

    private FieldDictionaryQueryParams() {
    }

    public static String likePattern(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        return "%" + raw.trim().toLowerCase(Locale.ROOT) + "%";
    }

    public static String equalsNormalized(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        return raw.trim().toLowerCase(Locale.ROOT);
    }
}
