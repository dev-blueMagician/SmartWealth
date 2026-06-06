package com.backend.wealth.cases.chat;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Lightweight per-message language tag for AI-engine narrate ({@code input_language}).
 * Favors {@code vi} when Vietnamese script markers appear; otherwise {@code en} when Latin letters exist;
 * falls back along prior user turns, then {@code en}.
 */
public final class ChatMessageLanguageDetector {

    public static final String LANG_VI = "vi";
    public static final String LANG_EN = "en";

    /**
     * Vietnamese letters outside ASCII, Latin-1 letters with diacritics (covers {@code à}, {@code đ}, …),
     * and the Vietnamese extension block.
     */
    private static final Pattern VIETNAMESE_OR_LATIN_DIACRITIC = Pattern.compile(
            "[\\u0110\\u0111\\u0102\\u0103\\u01A0\\u01A1\\u01AF\\u01B0"
                    + "\\u1EA0-\\u1EFF\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u00FF]"
    );

    /** Short replies with no clear language — caller may fall back to prior user turns. */
    private static final Pattern TRIVIAL_OR_NON_LETTER_REPLY = Pattern.compile(
            "(?is)^(ok\\.?|okay|k\\.?|yes|yep|yeah|no|nope|nah|thanks?|ty|👍|\\+1|[\\d\\s.,:;\\-!?…'\"()\\[\\]]+)$"
    );

    private ChatMessageLanguageDetector() {}

    /**
     * @param userMessage latest RM message for this narrate call (may be blank for some system paths)
     * @param conversationHistory chronological turns with {@code role} and {@code content} (same shape as AI-engine)
     */
    public static String detectForNarrate(String userMessage, List<Map<String, Object>> conversationHistory) {
        String primary = userMessage != null ? userMessage.trim() : "";
        String fromPrimary = classifyPlainText(primary);
        if (fromPrimary != null) {
            return fromPrimary;
        }
        if (conversationHistory != null) {
            for (int i = conversationHistory.size() - 1; i >= 0; i--) {
                Map<String, Object> turn = conversationHistory.get(i);
                if (turn == null) {
                    continue;
                }
                Object roleObj = turn.get("role");
                if (roleObj == null || !"user".equalsIgnoreCase(roleObj.toString().trim())) {
                    continue;
                }
                Object content = turn.get("content");
                if (content == null) {
                    continue;
                }
                String fromHist = classifyPlainText(content.toString().trim());
                if (fromHist != null) {
                    return fromHist;
                }
            }
        }
        return LANG_EN;
    }

    /** {@code vi}, {@code en}, or {@code null} if no letters (caller may try history). */
    private static String classifyPlainText(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        if (VIETNAMESE_OR_LATIN_DIACRITIC.matcher(text).find()) {
            return LANG_VI;
        }
        if (TRIVIAL_OR_NON_LETTER_REPLY.matcher(text).matches() || !containsAnyLetter(text)) {
            return null;
        }
        if (containsLatinLetter(text)) {
            return LANG_EN;
        }
        return null;
    }

    private static boolean containsLatinLetter(String text) {
        return text.codePoints().anyMatch(cp -> Character.isLetter(cp)
                && Character.UnicodeScript.of(cp) == Character.UnicodeScript.LATIN);
    }

    private static boolean containsAnyLetter(String text) {
        return text.codePoints().anyMatch(Character::isLetter);
    }
}
