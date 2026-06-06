# Endpoint & luồng chạy (SmartWealth orchestration)

Schema MVP: một bảng `orchestration_request`; queue AI dùng `workflow_event` + `workflow_ai_trigger` + `ai_result` / `ai_finding`.

**Ma trận tương tác (AssessmentCode)**: runtime đọc **`ai_interaction.loop_input`** và **`system_prompt`** trong PostgreSQL (SSOT sau khi seed). Mapping phase → `assessment_code` khi chưa có DB lấy từ embedded **`catalog_seed.CASE_PHASE_ASSESSMENT_MANIFEST`**. **ánh xạ cột → bước `ChecklistOrchestrator`** nằm trong `interaction_catalog.py` (`ORCHESTRATOR_COLUMN_BINDING`). Mã trong DB (`interaction_id` / `assessment_code`) dùng **cùng chuỗi** với enum **`AssessmentCode`**. Pytest đặt `SMARTWEALTH_INTERACTION_CATALOG_SOURCE=snapshot` (embedded `catalog_seed.INTERACTION_CATALOG_SEED`). DB cũ: chạy `scripts/sql/migrate_assessment_codes_to_common.sql`.

### Cột `orchestration_request.assessment_code` (đúng theo catalog)

| Mục | Chi tiết |
|-----|-----------|
| **Schema** | `VARCHAR(64) NOT NULL DEFAULT 'onboarding_completeness'` — định nghĩa trong `orchestration_minimal.sql` (bảng `orchestration_request`). |
| **Ý nghĩa** | Chọn **interaction** trong `interaction_catalog`: resolver đọc `get_interaction_spec(assessment_code)`, build `InteractionCatalogView` (các cột journey phase, intent, trigger, input/output contract, expectation, HITL, `ai_type`) vào `OrchestrationContext.catalog`. Pipeline onboarding completeness yêu cầu mã khớp `AssessmentCode.ONBOARDING_COMPLETENESS`. |
| **Loader** | `load_orchestration_request` (`AI-engine/app/infrastructure/orchestration/sql_orchestration_request_loader.py`) map cột DB → `OrchestrationRequest.assessment_code`; SQL dùng `COALESCE(assessment_code, 'onboarding_completeness')` nếu hàng cũ chưa có giá trị. |
| **DB đã tạo trước khi có cột** | Repo không có migration riêng: thêm tay `ALTER TABLE orchestration_request ADD COLUMN IF NOT EXISTS assessment_code VARCHAR(64) NOT NULL DEFAULT 'onboarding_completeness';` (hoặc tái tạo bảng từ `orchestration_minimal.sql`). |
| **Seed** | `seed_orchestration_complete.sql` / `seed_orchestration_incomplete.sql` ghi rõ `assessment_code` (ví dụ `'onboarding_completeness'`) cùng `workflow_id` / `request_id` demo. |
| **Khác với trigger** | `workflow_ai_trigger.assessment_code` quyết định **runner nào** khi drain queue (Luồng A). Cột trên `orchestration_request` quyết định **catalog snapshot** khi load request cho orchestrator (Luồng A/B). Runner nhận mã từ trigger và **ghi đè** `assessment_code` trên request khi thực thi (`execute_assessment_with_conn`). |

## Bảng nhanh — HTTP API

| Luồng | Method | Path | Auth internal | Body / ghi chú |
|--------|--------|------|----------------|-----------------|
| **Catalog — phase → assessments** | `GET` | `/api/v1/case-phase-assessments` | Không | Query tuỳ chọn `?case_phase=ONBOARDING` (uppercase). Không query → `{ version, phase_order, phases }`. SSOT PostgreSQL: bảng `case_phase` + `ai_interaction` (seed từ embedded `catalog_seed` qua `scripts/seed_ai_interaction_catalog.py`). |
| **A0 — Seed queue fixtures** | `POST` | `/internal/workflow/seed-fixtures` | `X-Internal-Token` hoặc `Authorization: Bearer` | Upsert `orchestration_request` + `workflow_ai_trigger`; có thể insert `workflow_event` theo danh sách state. **`workflow_id` bắt buộc** để nối đúng workflow đã tạo. **Idempotence:** bỏ qua insert event nếu đã có pending cùng `workflow_id` + `from_state` + `to_state` → response có `skipped_duplicate_pending_events`. |
| **A0b — Gợi ý seed (UI)** | `GET` | `/internal/workflow/orchestration-seed-hints/{workflow_id}` | `X-Internal-Token` hoặc `Authorization: Bearer` | Query `assessment_code` (default `onboarding_completeness`). Trả `from_state` / `to_states` (ưu tiên cặp từ `workflow_event` khớp assessment qua join `workflow_ai_trigger`; không có event thì default + trigger), `orchestration_request` (latest), `workflow_event` (match hoặc null). |
| **A — Drain queue** | `POST` | `/internal/workflow/process-ai-events` | `X-Internal-Token` hoặc `Authorization: Bearer` | `{"limit": 10}` (mặc định server: 20, tối đa 500) — đọc `workflow_event`, chạy runner đã đăng ký (theo `workflow_ai_trigger.assessment_code`), ghi DB |
| **A2 — Audit workflow (internal)** | `GET` | `/internal/workflow/audit/{workflow_id}` | Cùng token | Liệt kê audit đã persist (`workflow_audit_event`), khớp `entity_id` khi gọi `state-changed`. |
| **B — Chạy assessment trực tiếp** | `POST` | `/internal/assessment/execute` | Cùng token | `{"request_id":"<uuid>"}` — chỉ đọc DB + pipeline onboarding completeness, **không** ghi `ai_result` |
| **C — State demo** | `POST` | `/internal/workflow/state-changed` | Cùng token | Chuyển state → orchestrator in-graph + ghi audit qua `PostgresAuditLogger` (Postgres), **không** đụng queue AI `workflow_event` |

Token lấy từ biến môi trường **`INTERNAL_WORKFLOW_EVENT_TOKEN`** trong `.env`.

---

## Nhãn `from_state` / `to_state` (queue `workflow_event`)

Đây là **chuỗi tự do** trên bảng `workflow_event`, **khác** `workflow_state.status` kiểu `RECEIVED` / `VALIDATED` (luồng HTTP demo backend). Processor drain queue tra **`to_state`** vào **`workflow_ai_trigger`** để chọn runner; **`from_state`** dùng cho chuỗi seed (nối bước), audit cạnh transition, và kiểm tra trùng pending khi seed.

Preset UI (dropdown) trên portal internal: `frontend/src/constants/workflowQueueStates.ts` — ví dụ chuỗi `DATA_CAPTURE` → `READY_FOR_VALIDATION` → `DISCOVERY_READY` → `PLAN_DRAFT_READY`. Mỗi `to_state` mới **phải** có dòng `workflow_ai_trigger` (và runner đăng ký nếu cần) trong Postgres; chỉ khai báo trên FE không đủ.

**Lưu ý:** Nếu nhiều `assessment_code` cùng map một `to_state`, một event có thể chạy **nhiều** assessment trong cùng lần drain (theo thứ tự codes trong DB).

---

## Luồng chính — SQL → API (prod-style, không script demo event)

Dùng khi **`workflow_event`** do SSOT / service khác insert (không phụ thuộc script demo SQL đã gỡ khỏi repo).

| Bước | Việc |
|------|------|
| 1 | Chạy SQL theo thứ tự: `orchestration_minimal.sql` → `workflow_ai_pipeline.sql` → `seed_workflow_ai_pipeline.sql` → `seed_orchestration_complete.sql` hoặc `seed_orchestration_incomplete.sql`. |
| 2 | `.env`: `DATABASE_URL` (hoặc `DB_*`), `INTERNAL_WORKFLOW_EVENT_TOKEN`. |
| 3 | Chạy app (từ repo root): `PYTHONPATH=AI-engine uvicorn app.main:app --host 0.0.0.0 --port 8000`. |
| 4 | Có ít nhất một `workflow_event` pending (`processed_at` NULL), `workflow_id` / `to_state` khớp trigger trong DB. |
| 5 | `POST /internal/workflow/process-ai-events`. |

**SQL tối thiểu (copy-paste)**

```bash
psql "$DATABASE_URL" -f AI-engine/scripts/sql/orchestration_minimal.sql
psql "$DATABASE_URL" -f AI-engine/scripts/sql/workflow_ai_pipeline.sql
psql "$DATABASE_URL" -f AI-engine/scripts/sql/seed_workflow_ai_pipeline.sql
psql "$DATABASE_URL" -f AI-engine/scripts/sql/seed_orchestration_complete.sql
```

Seed demo `orchestration_request` dùng `feature_flags` ví dụ `{"onboarding_completeness_enabled": true}`.

---

## Tuỳ chọn — máy dev không có producer event

Không có script SQL demo riêng trong repo: dùng **`POST /internal/workflow/seed-fixtures`** (xem mục curl Luồng A) hoặc `INSERT` tay vào `workflow_event` sau khi đã có trigger trong `workflow_ai_trigger`.

Sau đó gọi **`POST /internal/workflow/process-ai-events`** như bước 5.

---

## Chuẩn bị DB (ý nghĩa từng file)

1. **`orchestration_minimal.sql`** — bảng `orchestration_request` (request + runtime + `assessment_code`, `ssot_snapshot_id`, …). DB cũ thiếu cột: `ALTER TABLE … ADD COLUMN IF NOT EXISTS assessment_code …` (không có file migration riêng trong repo).
2. **`workflow_ai_pipeline.sql`** — `workflow_ai_trigger`, `workflow_event`, `ai_result`, `ai_finding`.
3. **`seed_workflow_ai_pipeline.sql`** — ví dụ: `to_state = READY_FOR_VALIDATION` → `assessment_code` (ví dụ `onboarding_completeness`) phải khớp runner đăng ký trong app (`AssessmentCode` / registry).
4. **`seed_orchestration_complete.sql` / `seed_orchestration_incomplete.sql`** — dữ liệu thử `orchestration_request`.

---

## Copy — `curl`

```bash
export BASE_URL="http://localhost:8010"
export INTERNAL_TOKEN="<INTERNAL_WORKFLOW_EVENT_TOKEN>"
```

### Luồng A — `process-ai-events`

Seed nhanh fixtures (thay cho chạy nhiều SQL seed file, hỗ trợ nhiều state):

```bash
curl -sS -X POST "${BASE_URL}/internal/workflow/seed-fixtures" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{
    "workflow_id": "33333333-3333-3333-3333-333333333333",
    "assessment_code": "onboarding_completeness",
    "to_states": ["READY_FOR_VALIDATION", "READY_FOR_APPROVAL", "READY_FOR_EXECUTION"],
    "seed_events": true,
    "start_from_state": "DATA_CAPTURE"
  }'
```

Response trả về `workflow_id`, `request_id`, các trigger state đã seed, danh sách `seeded_events`, và khi có bước bị bỏ qua do trùng pending: `skipped_duplicate_pending_events`.

### Gợi ý form seed (curl)

```bash
curl -sS "${BASE_URL}/internal/workflow/orchestration-seed-hints/${WORKFLOW_ID}?assessment_code=onboarding_completeness" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}"
```

Sau đó gọi drain queue:

```bash
curl -sS -X POST "${BASE_URL}/internal/workflow/process-ai-events" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{"limit": 10}'
```

Bearer:

```bash
curl -sS -X POST "${BASE_URL}/internal/workflow/process-ai-events" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer ${INTERNAL_TOKEN}" \
  -d '{"limit": 10}'
```

### Luồng B — `/internal/assessment/execute`

Handler dùng **`AssessmentExecuteService`** → PostgreSQL pipeline **`build_onboarding_completeness_orchestrator`**.

```bash
curl -sS -X POST "${BASE_URL}/internal/assessment/execute" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{"request_id":"44444444-4444-4444-4444-444444444444"}'
```

### Luồng chat — `/internal/chat/turn`

Cùng token nội bộ như workflow. Chạy **catalog assessment** với runtime snapshot (không cần hàng `orchestration_request`). Backend lưu tin nhắn rồi gọi endpoint này.

```bash
curl -sS -X POST "${BASE_URL}/internal/chat/turn" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{"case_id":"<uuid>","phase_code":"ONBOARDING","assessment_code":"onboarding_completeness","user_message":"hello","sender_role":"RM"}'
```

### Luồng chat — `/internal/chat/detect-intent`

Phân loại **READ_INFORMATION | UPDATE_INFORMATION | GENERAL** (heuristic) và gợi ý `suggested_assessment_code` theo phase + manifest.

```bash
curl -sS -X POST "${BASE_URL}/internal/chat/detect-intent" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{"case_id":"<uuid>","phase_code":"ONBOARDING","user_message":"Case còn thiếu gì?","conversation_history":[{"role":"user","content":"xin chào"}]}'
```

### Luồng chat — `/internal/chat/narrate` (pass 2)

Gọi LLM để sinh **`chat_reply`** tự nhiên từ `pass1_findings` hoặc `pass1_output_text` + câu hỏi user (và optional `conversation_history`). Cùng điều kiện bật LLM như assessment (`ASSESSMENT_LLM_ENABLED` + key provider). Backend sau mỗi `chat/turn` có thể gọi bước này rồi lưu `chat_reply` làm nội dung bubble.

```bash
curl -sS -X POST "${BASE_URL}/internal/chat/narrate" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{"user_message":"Tóm tắt giúp tôi","phase_code":"ONBOARDING","assessment_code":"onboarding_completeness","pass1_findings":{"assessment_id":"onboarding_completeness","is_complete":false}}'
```

### Luồng C — `state-changed`

```bash
curl -sS -X POST "${BASE_URL}/internal/workflow/state-changed" \
  -H "Content-Type: application/json" \
  -H "X-Internal-Token: ${INTERNAL_TOKEN}" \
  -d '{
    "entity_type": "WORKFLOW",
    "entity_id": "33333333-3333-3333-3333-333333333333",
    "from_state": "DATA_CAPTURE",
    "to_state": "READY_FOR_VALIDATION",
    "triggered_by": "SYSTEM",
    "occurred_at": "2026-05-01T12:00:00Z"
  }'
```

---

## Response ví dụ — Luồng A (`process-ai-events`)

Mã trong DB (`assessment_code`) phải có runner trong app (registry). Ví dụ `onboarding_completeness` = onboarding completeness.

```json
{
  "processed": 1,
  "outcomes": [
    {
      "event_id": "...",
      "status": "completed",
      "request_id": "44444444-4444-4444-4444-444444444444",
      "assessments": [
        { "assessment_code": "onboarding_completeness", "result_id": "..." }
      ],
      "assessment": "onboarding_completeness",
      "result_id": "..."
    }
  ]
}
```

Nếu chỉ một assessment, có thêm `assessment` và `result_id` dẹp; nhiều mã thì xem `assessments`.

**Skip / lỗi:** `processing_error` trên `workflow_event`, hoặc `reason` trong outcome: `NO_AI_TRIGGER`, `NO_REGISTERED_RUNNER`, `ORCHESTRATION_REQUEST_NOT_FOUND`, …

---

## Luồng B — Response gợi ý

JSON giống `AIResult` + `findings` parse từ `output_text`. **Không** insert `ai_result` / `ai_finding`.

---

## UUID demo (seed)

| Field | Ví dụ |
|-------|--------|
| `workflow_id` | `33333333-3333-3333-3333-333333333333` |
| `request_id` (complete) | `44444444-4444-4444-4444-444444444444` |

`workflow_event.workflow_id` phải trùng `orchestration_request.workflow_id` khi drain queue.

---

## Script demo server (không bắt buộc)

`AI-engine/scripts/assessment_test_server.py` — FastAPI tối giản + mock context, ví dụ:

- `POST /api/v1/assessment/execute`
- `GET /api/v1/assessment/audit/{workflow_id}`

Chạy: `PYTHONPATH=AI-engine python AI-engine/scripts/assessment_test_server.py` (mặc định port **8010**). Không thay cho app chính có Postgres.
