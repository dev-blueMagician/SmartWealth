package com.backend.wealth.cases.chat.stream;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/** Writes NDJSON lines to a servlet stream without closing the underlying {@link OutputStream}. */
@Slf4j
public final class CaseChatNdjsonWriter {

    private CaseChatNdjsonWriter() {}

    public static void writeLine(OutputStream out, ObjectMapper mapper, Object event) throws IOException {
        out.write(mapper.writeValueAsString(event).getBytes(StandardCharsets.UTF_8));
        out.write('\n');
        out.flush();
    }

    public static void writeErrorAndDone(OutputStream out, ObjectMapper mapper, String message) {
        try {
            writeLine(out, mapper, new CaseChatStreamEvents.Error(message));
            writeLine(out, mapper, CaseChatStreamEvents.Done.withoutIds());
        } catch (IOException ex) {
            log.warn("Could not write NDJSON error to client stream: {}", ex.getMessage());
        }
    }
}
