package com.backend.wealth.cases.chat;

import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;

class ChatMessageLanguageDetectorTest {

    @Test
    void vietnameseWithDiacritics() {
        assertEquals(
                ChatMessageLanguageDetector.LANG_VI,
                ChatMessageLanguageDetector.detectForNarrate("Khách hàng đã nộp CCCD chưa?", List.of()));
    }

    @Test
    void englishAscii() {
        assertEquals(
                ChatMessageLanguageDetector.LANG_EN,
                ChatMessageLanguageDetector.detectForNarrate("Has the client uploaded proof of address?", List.of()));
    }

    @Test
    void shortCurrentMessageFallsBackToLastUserTurn() {
        Map<String, Object> prior = new LinkedHashMap<>();
        prior.put("role", "user");
        prior.put("content", "Cho tôi biết trạng thái hồ sơ hiện tại.");
        assertEquals(
                ChatMessageLanguageDetector.LANG_VI,
                ChatMessageLanguageDetector.detectForNarrate("ok", List.of(prior)));
    }

    @Test
    void blankMessageDefaultsToEnglish() {
        assertEquals(
                ChatMessageLanguageDetector.LANG_EN,
                ChatMessageLanguageDetector.detectForNarrate("   ", List.of()));
    }
}
