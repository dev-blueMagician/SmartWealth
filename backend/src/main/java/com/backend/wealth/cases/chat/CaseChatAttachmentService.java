package com.backend.wealth.cases.chat;

import com.backend.wealth.cases.documents.model.CaseDocument;
import com.backend.wealth.cases.documents.model.StoredDocument;
import com.backend.wealth.cases.documents.repository.CaseDocumentRepository;
import com.backend.wealth.cases.documents.repository.StoredDocumentRepository;
import com.backend.wealth.cases.model.WealthCase;
import com.backend.wealth.cases.repository.WealthCaseRepository;
import com.backend.wealth.exception.BusinessException;
import com.backend.wealth.exception.NotFoundException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CaseChatAttachmentService {

    private static final long MAX_BYTES_DEFAULT = 25L * 1024 * 1024;

    private final WealthCaseRepository wealthCaseRepository;
    private final StoredDocumentRepository storedDocumentRepository;
    private final CaseDocumentRepository caseDocumentRepository;

    @Value("${wealth.case-chat.upload-directory:./data/case-chat-uploads}")
    private String uploadDirectoryRaw;

    @Value("${wealth.case-chat.max-file-size-bytes:" + MAX_BYTES_DEFAULT + "}")
    private long maxFileSizeBytes;

    @Transactional
    public ChatAttachmentUploadResponse upload(
            UUID caseId,
            MultipartFile file,
            String docKind,
            Authentication authentication
    ) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException("file is required");
        }
        WealthCase c = wealthCaseRepository.findById(caseId)
                .orElseThrow(() -> new NotFoundException("Case not found: " + caseId));
        if (file.getSize() > maxFileSizeBytes) {
            throw new BusinessException("File exceeds maximum allowed size.");
        }
        String kind = (docKind == null || docKind.isBlank()) ? "CHAT_UPLOAD" : docKind.trim();
        if (kind.length() > 64) {
            kind = kind.substring(0, 64);
        }
        String original = file.getOriginalFilename();
        if (original == null || original.isBlank()) {
            original = "upload.bin";
        }
        if (original.length() > 500) {
            original = original.substring(0, 500);
        }
        String safe = sanitizeFilename(original);

        Path base = Paths.get(uploadDirectoryRaw).toAbsolutePath().normalize();
        Path caseDir = base.resolve(caseId.toString());
        try {
            Files.createDirectories(caseDir);
        } catch (IOException ex) {
            throw new BusinessException("Cannot create upload directory: " + ex.getMessage());
        }

        StoredDocument sd = StoredDocument.builder()
                .storageKey(null)
                .originalFilename(original)
                .contentType(truncate(file.getContentType(), 120))
                .byteSize(file.getSize())
                .uploadedBy(resolveUploaderId(authentication))
                .build();
        sd = storedDocumentRepository.save(sd);
        storedDocumentRepository.flush();

        String relativeKey = caseId + "/" + sd.getId() + "_" + safe;
        Path target = base.resolve(relativeKey).normalize();
        if (!target.startsWith(base)) {
            throw new BusinessException("Invalid upload path.");
        }
        try (InputStream in = file.getInputStream()) {
            Files.copy(in, target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException ex) {
            throw new BusinessException("Failed to store file: " + ex.getMessage());
        }

        sd.setStorageKey(relativeKey);
        sd = storedDocumentRepository.save(sd);

        CaseDocument cd = CaseDocument.builder()
                .wealthCase(c)
                .document(sd)
                .docKind(kind)
                .status(CaseDocument.STATUS_PENDING)
                .phaseCode(truncate(c.getPhase(), 50))
                .build();
        caseDocumentRepository.save(cd);

        log.info("Case chat attachment stored caseId={} caseDocumentId={} key={}", caseId, cd.getId(), relativeKey);

        return new ChatAttachmentUploadResponse(
                cd.getId(),
                sd.getId(),
                sd.getOriginalFilename(),
                sd.getContentType(),
                sd.getByteSize(),
                cd.getDocKind()
        );
    }

    @Transactional
    public DocumentReviewResponse reviewDocument(
            UUID caseId,
            UUID caseDocumentId,
            String newStatus,
            Authentication authentication
    ) {
        if (!CaseDocument.STATUS_VERIFIED.equals(newStatus) && !CaseDocument.STATUS_REJECTED.equals(newStatus)) {
            throw new BusinessException("status must be VERIFIED or REJECTED");
        }
        CaseDocument cd = caseDocumentRepository.findById(caseDocumentId)
                .orElseThrow(() -> new NotFoundException("CaseDocument not found: " + caseDocumentId));
        if (!cd.getWealthCase().getId().equals(caseId)) {
            throw new BusinessException("CaseDocument does not belong to this case.");
        }
        String previous = cd.getStatus();
        cd.setStatus(newStatus);
        cd.setReviewedBy(resolveUploaderId(authentication));
        cd.setReviewedAt(java.time.OffsetDateTime.now());
        caseDocumentRepository.save(cd);

        log.info("Case document reviewed caseId={} caseDocumentId={} {} → {}",
                caseId, caseDocumentId, previous, newStatus);

        return new DocumentReviewResponse(
                cd.getId(),
                cd.getDocument().getId(),
                cd.getDocKind(),
                previous,
                newStatus
        );
    }

    public record DocumentReviewResponse(
            UUID caseDocumentId,
            UUID documentId,
            String docKind,
            String previousStatus,
            String currentStatus
    ) {
    }

    private static UUID resolveUploaderId(Authentication authentication) {
        if (authentication == null || authentication.getName() == null) {
            return null;
        }
        try {
            return UUID.fromString(authentication.getName());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return null;
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static String sanitizeFilename(String name) {
        String cleaned = name.replace("\\", "_").replace("/", "_").replaceAll("[^a-zA-Z0-9._-]", "_");
        if (cleaned.isBlank()) {
            cleaned = "file";
        }
        return cleaned.length() > 200 ? cleaned.substring(0, 200) : cleaned;
    }

    public record ChatAttachmentUploadResponse(
            UUID caseDocumentId,
            UUID documentId,
            String originalFilename,
            String contentType,
            Long byteSize,
            String docKind
    ) {
    }
}
