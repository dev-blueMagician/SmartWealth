package com.backend.wealth.discovery.support;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Minimal RFC 4180 CSV parser (quoted fields, commas).
 */
public final class DiscoveryCsvParser {

    private DiscoveryCsvParser() {
    }

    public static List<Map<String, String>> parse(InputStream input) throws IOException {
        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(input, StandardCharsets.UTF_8))) {
            String headerLine = reader.readLine();
            if (headerLine == null || headerLine.isBlank()) {
                return List.of();
            }
            List<String> headers = parseLine(headerLine);
            List<Map<String, String>> rows = new ArrayList<>();
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isBlank()) {
                    continue;
                }
                List<String> cells = parseLine(line);
                Map<String, String> row = new HashMap<>();
                for (int i = 0; i < headers.size(); i++) {
                    String key = normalizeHeader(headers.get(i));
                    String value = i < cells.size() ? cells.get(i).trim() : "";
                    row.put(key, value);
                }
                rows.add(row);
            }
            return rows;
        }
    }

    private static String normalizeHeader(String header) {
        return header.trim().toLowerCase(Locale.ROOT);
    }

    static List<String> parseLine(String line) {
        List<String> fields = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (c == '"') {
                if (inQuotes && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    current.append('"');
                    i++;
                } else {
                    inQuotes = !inQuotes;
                }
            } else if (c == ',' && !inQuotes) {
                fields.add(current.toString());
                current.setLength(0);
            } else {
                current.append(c);
            }
        }
        fields.add(current.toString());
        return fields;
    }

    public static String get(Map<String, String> row, String... aliases) {
        for (String alias : aliases) {
            String key = alias.toLowerCase(Locale.ROOT);
            if (row.containsKey(key)) {
                String v = row.get(key);
                if (v != null && !v.isBlank()) {
                    return v.trim();
                }
            }
        }
        return "";
    }
}
