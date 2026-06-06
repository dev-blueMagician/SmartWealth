# SmartWealth Backend (`wealth-backend`)

Spring Boot 3 service under `com.backend.wealth`: PostgreSQL, Flyway, JPA entities in per-package **`model`** folders, OpenAPI-first REST APIs (6 phase specs), Spring Security (public routes for listed API prefixes).

**Development guide (toàn repo):** [`docs/DEVELOPMENT_GUIDE.md`](../docs/DEVELOPMENT_GUIDE.md)

## OpenAPI specs (6 files → 6 codegen executions)

| Phase | File | Generated API package (interfaces) |
|-------|------|-------------------------------------|
| 1 RM | `api-spec-phase1-rm.yaml` | `com.backend.wealth.api.rm` |
| 2 Client | `api-spec-phase2-client.yaml` | `com.backend.wealth.api.clientdata` (`MobileApi`, `ClientsApi`, `CasesApi`) |
| 3 WM | `api-spec-phase3-wm.yaml` | `com.backend.wealth.api.wm` (`ClientsApi`, `PlansApi`) |
| 4 Decision | `api-spec-phase4-decision.yaml` | `com.backend.wealth.api.decisiongate` (`RecommendationsApi`) |
| 5 IM | `api-spec-phase5-im.yaml` | `com.backend.wealth.api.im` (`ExecutionApi`) |
| 6 Admin | `api-spec-phase6-admin.yaml` | `com.backend.wealth.api.admin` (`ExecutionApi`) |

DTOs are generated into `com.backend.wealth.openapi.model`. Run `mvn compile` to regenerate.

---

## WEALTH CORE – ENDPOINT & FLOW SUMMARY

### Tổng quan lifecycle (1 câu)

Toàn bộ hệ thống chạy theo **CASE.id**: Client chỉ nhập dữ liệu; WM/RM tạo logic nghiệp vụ; Client là **sole decision maker**; **Execution** chỉ mở sau khi plan được **APPROVED**.

### 1 RM – Khởi tạo Business Context (ENTRY POINT)

**Mục tiêu**

- Tạo authority context
- Khởi tạo lifecycle duy nhất

**Endpoints**

- **POST** `/api/cases`  
  Tạo: **CLIENT** (default `AWAITING_ACTIVATION`), **CASE** (`ONBOARDING`, `IN_PROGRESS`), các **TASK** (`CLIENT_REGISTRATION`, `PROFILE_COMPLETION`), **AUDIT_EVENT**.  
  Đây là **entry point duy nhất** của core lifecycle.

- **POST** `/api/invitations`  
  Gửi invitation (stub — không đổi state core).

### 2 CLIENT – Nhập dữ liệu cốt lõi (NO DECISION)

**Mục tiêu**

- Thu thập data foundation
- Không tạo logic / decision

**Endpoints**

- **POST** `/mobile/register` — activate client; hoàn thành task **CLIENT_REGISTRATION**
- **PUT** `/clients/{clientId}/profile` — cập nhật profile (risk, residency, …); hoàn thành **PROFILE_COMPLETION**
- **POST** `/clients/{clientId}/assets` và **POST** `/clients/{clientId}/goals` — discovery (chỉ lưu)
- **POST** `/cases/{caseId}/discovery/check` — discovery xong; case chuyển **phase `PLANNING`**, **status `READY`** (`DiscoveryReadinessService`)

### 3 WM – CORE BUSINESS LOGIC (PLANNING)

**Mục tiêu**

- Tạo & tính toán Financial Plan
- (Mới) Draft theo **plan template**: regenerate từ discovery, finalize, export DOCX — xem **§11**

**Endpoints (OpenAPI)**

- **POST** `/clients/{clientId}/plans` — **FINANCIAL_PLAN** (`DRAFT`), version v1
- **POST** `/plans/{planId}/draft` — chạy tính toán placeholder; cập nhật JSON `content`
- **POST** `/plans/{planVersionId}/recommendations` — tạo **RECOMMENDATION** (`planVersionId` = `financial_plan.id`)
- **GET** `/clients/{clientId}/plans`, **GET** `/plans/{planVersionId}/recommendations` — đọc plan & recommendations

### 4 CLIENT – SOLE DECISION MAKER (GATE)

**Mục tiêu**

- Gate quan trọng nhất — sau bước này mới cho execution

**Endpoint**

- **POST** `/recommendations/{recommendationId}/decision` — **APPROVED** / **REJECTED**  
  Nếu **APPROVED**: `financial_plan.is_approved = true`, `financial_plan.status = APPROVED`.

### 5 IM – INVESTMENT STRATEGY (PRE-EXECUTION)

**Mục tiêu**

- Chuẩn bị instruction; chưa gửi đi đâu

**Endpoint**

- **POST** `/execution/instructions` — **EXECUTION_INSTRUCTION** (`DRAFT`), gắn `recommendation_id`

### 6 ADMIN / OPS – OPERATIONAL COMMIT (END)

**Mục tiêu**

- Thực thi & ghi nhận kết quả thực tế

**Endpoints**

- **POST** `/execution/send` — instruction → **SENT**
- **POST** `/execution/results` — ghi nhận trade result; tạo/cập nhật **PORTFOLIO** + **portfolio_allocation**; instruction → **EXECUTED**

### 7 CHAT – AI-POWERED CASE CHAT CHANNEL

**Mục tiêu**

- Kênh chat AI gắn với case lifecycle; hỗ trợ intent detection, đính kèm tài liệu, visibility nội bộ/khách hàng.

**Endpoints**

- **GET** `/api/cases/{caseId}/chat/thread` — lấy hoặc tạo thread (idempotent, channel = `CASE_CHAT`)
- **GET** `/api/cases/{caseId}/chat/messages?threadId=` — liệt kê message (lọc visibility theo role)
- **POST** `/api/cases/{caseId}/chat/messages` — gửi message + nhận AI reply đồng bộ
- **POST** `/api/cases/{caseId}/chat/detect-intent` — phân loại intent (không persist message)
- **POST** `/api/cases/{caseId}/chat/attachments` — upload tài liệu (multipart, trả `caseDocumentId`)
- **PATCH** `/api/cases/{caseId}/chat/attachments/{caseDocumentId}/status` — review trạng thái tài liệu

**Model chính:** `CaseChatThread` (1 thread/case), `CaseChatMessage` (senderKind: USER/ASSISTANT/SYSTEM, visibility: ALL/INTERNAL).

- **POST** `/api/cases/{caseId}/chat/messages/stream` — gửi message, trả **NDJSON** stream (`application/x-ndjson`); dùng khi cần streaming thay cho sync
- **DELETE** `/api/cases/{caseId}/chat/messages?threadId=` — xóa message theo thread (body tùy chọn)

### 8 AUTH – Đăng nhập & phiên

**Endpoints**

- **POST** `/api/auth/login` — đăng nhập, trả JWT (public)
- **GET** `/api/auth/me` — thông tin user hiện tại (cần Bearer token)

### 9 CASE QUERY – Tra cứu case (RM / WM / IM / ADMIN)

**Endpoints**

- **GET** `/api/cases` — danh sách case
- **GET** `/api/cases/{caseId}` — chi tiết case
- **GET** `/api/cases/{caseId}/tasks` — task theo case
- **GET** `/api/cases/{caseId}/client-profile` — profile client gắn case
- **GET** `/api/cases/{caseId}/documents` — tài liệu case

### 10 DISCOVERY – Cấu hình câu hỏi & dữ liệu case

**Mục tiêu**

- Admin cấu hình bộ câu hỏi / field dictionary / mapping
- RM/WM đọc & ghi answer; projection dataset theo case

**Cấu hình (ADMIN ghi, RM/WM/IM đọc)**

| Prefix | Endpoints |
|--------|-----------|
| `/questions` | **GET** list; **POST** create; **PUT** `/{questionId}`; **DELETE** `/{questionId}`; **POST** `/import` (CSV multipart) |
| `/questions/{questionId}/options` | **GET** list; **POST** create option |
| `/field-dictionary` | **GET** list (phân trang); **GET** `/count`; **GET** `/{systemFieldName}`; **POST** create; **PUT** `/{systemFieldName}`; **DELETE**; **POST** `/import` (CSV) |
| `/mappings` | **GET** list; **POST** create; **PUT** `/{id}`; **DELETE** `/{id}` |

**Answers (theo case)**

- **GET** `/answers?caseId=` — liệt kê answer
- **POST** `/answers` — submit answer

**Case discovery dataset** (`/cases/{caseId}/discovery`)

- **POST** `/rebuild` — tái tạo projection từ answers
- **GET** `/fields?status=&page=&size=` — trang field (filled/missing/…)
- **GET** `/dataset` — dataset đầy đủ
- **GET** `/summary?dataDomain=&filledLimit=&missingLimit=&unmappedLimit=` — payload gọn cho UI/LLM

**Discovery AI** (`/discovery/ai`, dùng `ai_llm_profile` active)

- **POST** `/suggest-answer`
- **POST** `/explain-question`
- **POST** `/missing-summary`
- **POST** `/suggest-mapping`

### 11 WM – PLANNING DRAFT (template-based lifecycle)

Bổ sung cho flow OpenAPI cũ (`/clients/.../plans`, `/plans/.../draft`): lifecycle draft gắn **plan_template**, export DOCX.

**Endpoints**

| Method | Path | Ý nghĩa |
|--------|------|---------|
| **GET** | `/cases/{caseId}/planning/drafts` | Danh sách draft theo case |
| **POST** | `/cases/{caseId}/planning/drafts` | Tạo draft (chọn template) |
| **GET** | `/planning/drafts/{planId}` | Chi tiết draft + payload |
| **POST** | `/planning/drafts/{planId}/regenerate` | Tính lại payload từ discovery |
| **POST** | `/planning/drafts/{planId}/finalize` | Chốt draft → plan |
| **POST** | `/planning/drafts/{planId}/export` | Export DOCX, tạo artifact |
| **GET** | `/planning/artifacts/{artifactId}/download` | Tải file export |

**Templates**

- **GET** `/planning/templates` — template **ACTIVE** (WM / ADMIN)
- **GET/POST/DELETE** `/api/admin/planning/templates` — quản lý template (ADMIN): list, **GET** `/{templateId}`, upload multipart, **POST** `/{templateId}/publish`, delete

**Đọc thêm (OpenAPI WM)**

- **GET** `/clients/{clientId}/plans` — danh sách plan/version
- **GET** `/plans/{planVersionId}/recommendations` — recommendations theo plan version

### 12 EXECUTION – Đọc instruction

- **GET** `/clients/{clientId}/execution/instructions` — liệt kê execution instruction theo client (RM / WM / IM / ADMIN)

### 13 WORKFLOW – Orchestration (n8n backend)

| Method | Path | Ý nghĩa |
|--------|------|---------|
| **GET** | `/api/workflows/create-options` | Metadata tạo workflow |
| **GET** | `/api/workflows/by-client/{clientId}` | Workflow link theo client |
| **POST** | `/api/v1/workflows` | Tạo workflow |
| **GET** | `/api/v1/workflows?limit=` | Danh sách |
| **GET** | `/api/v1/workflows/{workflowId}` | Chi tiết |
| **GET** | `/api/v1/workflows/{workflowId}/audit-events` | Audit events |
| **POST** | `/api/v1/workflows/{workflowId}/run` | Chạy workflow |
| **POST** | `/api/v1/workflows/{workflowId}/human-approval` | Duyệt human-in-the-loop |

### 14 ADMIN – Users, clients, AI engine

| Prefix | Endpoints |
|--------|-----------|
| `/api/admin/users` | **GET** list; **GET** `/{id}`; **POST** create; **PATCH** `/{id}` |
| `/api/admin/clients` | **GET** — client picker |
| `/api/admin/ai-engine/case-phases` | CRUD theo `phaseCode` |
| `/api/admin/ai-engine/llm-profiles` | CRUD; **GET** `/active` |
| `/api/admin/ai-engine/ai-interactions` | CRUD; **GET** `?phaseCode=` |

---

### Tổng hợp nhanh – Endpoint theo flow

| Phase | Role | Endpoint chính | Ý nghĩa |
|-------|------|----------------|---------|
| — | Any | POST `/api/auth/login`, GET `/api/auth/me` | Auth |
| 1 | RM | POST `/api/cases`, GET `/api/cases/**` | Entry + tra cứu case |
| 2 | Client | `/mobile/register`, `/clients/.../profile`, `/assets`, `/goals` | Data foundation |
| 2b | RM/WM | `/answers`, `/cases/{id}/discovery/**`, `/discovery/ai/**` | Discovery data & AI assist |
| 2c | Admin | `/questions`, `/field-dictionary`, `/mappings` | Discovery config |
| 3 | WM | `/clients/.../plans`, `/plans/...`, `/cases/.../planning/drafts`, `/planning/templates` | Plan + draft lifecycle |
| 4 | Client | POST `/recommendations/{id}/decision` | Decision gate |
| 5 | IM | POST `/execution/instructions`, GET `/clients/.../execution/instructions` | Execution |
| 6 | Admin | POST `/execution/send`, `/execution/results`, `/api/admin/**` | Ops + admin |
| 7 | Any | `/api/cases/{id}/chat/*` | AI chat (sync, stream, attachments) |
| — | RM/WM/IM | `/api/v1/workflows/**`, `/api/workflows/**` | Workflow orchestration |

---

## Chạy local

1. PostgreSQL + DB/user khớp `src/main/resources/application.yml`.
2. `mvn spring-boot:run`
3. Swagger UI: `http://localhost:8090/swagger-ui.html`

## Schema notes

- Bảng PostgreSQL `"case"` là reserved word — map JPA `WealthCase` với `@Table(name = "\"case\"")`.
- `portfolio_allocation`: phần allocation theo `portfolio_id` (chuẩn hóa từ DDL gốc thiếu tên bảng).
- `execution_instruction`: Flyway `V2__execution_instruction.sql`.
- `plan_template`, `plan_artifact`, cột `financial_plan.template_id` / `finalized_at`: Flyway `V13__planning_template_and_lifecycle.sql`.
- `plan_template.structure_json`, `placeholders_detected`, `analyzed_at`: Flyway `V14__plan_template_structure.sql`.

## Security (roles)

JWT Bearer; role: `RM`, `WM`, `IM`, `ADMIN`. Một số route client-facing (`/mobile/register`, profile/assets/goals, decision gate) là **permitAll**. Chi tiết matcher: `SecurityConfig.java`.

## Package layout (per domain)

Mỗi vùng có **`model`**, **`repository`**, **`service`**, **`web`** (controller khi có), **`constants`**, **`config`** (`@Configuration` module stub cho mở rộng).
