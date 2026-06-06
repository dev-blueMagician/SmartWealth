# SmartWealth AI Core — Coding Guide

Tài liệu này giúp **người mới onboard**, **maintain**, và **mở rộng** codebase. Đọc kèm [`README.md`](../README.md) (nguyên tắc kiến trúc tổng quan).

---

## Mục lục

1. [Tư duy cốt lõi](#1-tư-duy-cốt-lõi)
2. [Bản đồ thư mục](#2-bản-đồ-thư-mục)
3. [Luồng code end-to-end (Assessment)](#3-luồng-code-end-to-end-assessment)
4. [Orchestrator checklist (7 bước)](#4-orchestrator-checklist-7-bước)
5. [Agent, prompt, LLM](#5-agent-prompt-llm)
6. [Mở rộng: interaction / assessment mới](#6-mở-rộng-interaction--assessment-mới)
7. [Cấu hình & chạy thử](#7-cấu-hình--chạy-thử)
8. [Test & chất lượng](#8-test--chất-lượng)
9. [Lộ trình học cho người mới](#9-lộ-trình-học-cho-người-mới)

---

## 1. Tư duy cốt lõi

| Khái niệm | Ý nghĩa trong repo này |
|-----------|------------------------|
| **Orchestrator** | Điều phối các bước có thứ tự (policy, chọn agent, gate…). Ví dụ: `ChecklistOrchestrator`. |
| **Agent** | Xử lý “bước AI” theo contract: stateless, nhận `OrchestrationContext`, trả `AIResult`. Domain port: `Agent` trong `app/domain/smartwealth/interfaces/ports.py`. |
| **Tool** | Logic/helpers xác định (lookup SSOT, …), không thay cho orchestrator. |
| **SSOT / context** | Dữ liệu case/request được resolve qua `ContextResolver` + `ContextDataRepository`. |
| **Interaction catalog** | Ma trận sản phẩm (`AssessmentCode`): journey phase, contract input/output, expectation — map vào `OrchestrationContext.catalog`. |

**Invariant** (trích tinh thần README): AI có thể draft; quyết định cuối và compliance là workflow/policy — không ẩn logic trong “magic” middleware.

---

## 2. Bản đồ thư mục

Toàn bộ Python source nằm trong **`AI-engine/`**. `pyproject.toml` nằm trong **`AI-engine/pyproject.toml`**; `PYTHONPATH` khi chạy tay nên là `AI-engine` (pytest và VS Code launch đã cấu hình).

| Đường dẫn | Vai trò |
|-----------|---------|
| `AI-engine/app/domain/` | Model domain, ports (`interfaces`), `interaction_catalog.py`; bootstrap dữ liệu trong `catalog_seed.py` (seed DB); SSOT runtime là PostgreSQL `ai_interaction`. |
| `AI-engine/app/application/services/` | Use-case tầng ứng dụng (assessment execute, workflow AI processor…). |
| `AI-engine/app/api/routes/` | FastAPI: internal assessment, workflow…. |
| `AI-engine/app/infrastructure/` | DB, config `Settings`, prompt loader, `DeepSeekAdapter`, container. |
| `AI-engine/app/orchestration/` | Orchestrator, agents onboarding completeness, `assessment/registry.py`, `assessment/codes.py`. |
| `AI-engine/app/infrastructure/prompts/` | `loader.py`: **`system_prompt`** lấy qua `InteractionSpec` (Postgres catalog; tests dùng snapshot). |
| `AI-engine/scripts/` | Server demo, SQL seed, `try_deepseek_prompt.py`. |
| `AI-engine/tests/unit/` | Pytest đơn vị. |

**Composition root:** `AI-engine/app/infrastructure/container.py` — wiring singleton đơn giản cho API.

---

## 3. Luồng code end-to-end (Assessment)

### 3.1. HTTP trực tiếp — `POST /internal/assessment/execute`

1. `AI-engine/app/main.py` — mount router internal assessment.
2. `AI-engine/app/api/routes/internal_assessment.py` — auth nội bộ + `container.assessment_execute_service.execute_by_request_id(request_id)`.
3. `AI-engine/app/application/services/assessment_execute_service.py` — `execute_assessment_postgres(settings, request_id)`.
4. `AI-engine/app/infrastructure/db/assessment_pg.py` — mở psycopg → `execute_assessment_with_conn(conn, request_id, settings)`.
5. `AI-engine/app/infrastructure/orchestration/sql_orchestration_request_loader.py` — load row → `OrchestrationRequest` (có `input_text`, `assessment_code`, SSOT…).
6. `AI-engine/app/infrastructure/context/sql_context_data_repository.py` — đọc runtime trên cùng row (`variables`, `session_id`, …).
7. `AI-engine/app/orchestration/smartwealth/context_resolver.py` — `RepositoryBackedContextResolver.resolve`: lookup `get_interaction_spec` → `OrchestrationContext` (+ `input_text` / `input_language`).
8. `AI-engine/app/orchestration/smartwealth/onboarding_completeness.py` — `build_onboarding_completeness_orchestrator(settings)` → `ChecklistOrchestrator` + `LocalAgentExecutor`.
9. `AI-engine/app/orchestration/smartwealth/orchestrator.py` — `Execute(request)` chạy 7 bước (mục 4).
10. Agent: `CompletenessAgent` hoặc `CompletenessLlmAgent` (mục 5).
11. Response JSON: map `AIResult`; `output_text` thường parse thành `findings`.

**Lưu ý:** Route này **không** persist `ai_result` vào DB (xem docstring route).

### 3.2. Workflow AI event (queue + persist)

1. `AI-engine/app/application/services/workflow_ai_event_processor.py` — đọc event, khớp `workflow_ai_trigger.assessment_code` với registry.
2. `AI-engine/app/orchestration/assessment/registry.py` — `run_registered_assessment(conn, request_id, assessment_code)` → gọi runner đã đăng ký (hiện `onboarding_completeness` → `execute_assessment_with_conn`).
3. `AI-engine/app/infrastructure/db/persist_assessment_pg.py` — ghi kết quả / findings.

Luồng bên trong runner giống mục 3.1 từ bước load request trở đi.

**Seed / catalog (dev & internal UI):**

- `workflow_seed_service.py` — `POST /internal/workflow/seed-fixtures` (chuỗi `workflow_event`, idempotence pending duplicate).
- `workflow_orchestration_context_service.py` — `GET /internal/workflow/orchestration-seed-hints/{workflow_id}`.
- `case_phase_assessments.py` — `GET /api/v1/case-phase-assessments` + manifest JSON trong `app/domain/smartwealth/`.

Chi tiết HTTP: `AI-engine/docs/endpoint.md`.

---

## 4. Orchestrator checklist (7 bước)

File: `AI-engine/app/orchestration/smartwealth/orchestrator.py` — class `ChecklistOrchestrator`.

| Bước | Hook | Gợi ý “sở hữu” cột product |
|------|------|---------------------------|
| 1 | `receive_trigger_event` | Journey / intent; validate `assessment_code` có trong catalog. |
| 2 | `build_context` | Input SSOT — delegate `ContextResolver`. |
| 3 | `run_policy_check` | Preconditions — `PolicyChecker`. |
| 4 | `select_agent` | Routing agent — `AgentSelector`. |
| 5 | `execute_agent` | Expectation + output chính — `AgentExecutor` → `Agent.execute`. |
| 6 | `apply_confidence_gate` | STOP / ESCALATE / DRAFT — `ConfidenceGate`. |
| 7 | `produce_result` | Envelope cuối (hiện chủ yếu passthrough). |

Các comment `# TODO` trên hook là **nhắc kiến trúc** (“luôn delegate qua port”), không có nghĩa bước đó chưa chạy — implementation đã gọi đúng port được inject.

Chi tiết mapping catalog ↔ hook: `AI-engine/app/domain/smartwealth/interaction_catalog.py` (`ORCHESTRATOR_COLUMN_BINDING`).

---

## 5. Agent, prompt, LLM

### 5.1. Rule-only agent

- `AI-engine/app/orchestration/smartwealth/agents/completeness_agent.py`
- Kiểm các field bắt buộc trên `OrchestrationContext`, không gọi repo/tool/LLM trong agent.

### 5.2. Agent + DeepSeek

- `AI-engine/app/orchestration/smartwealth/agents/completeness_llm_agent.py`
- Thứ tự trong **một lần** `execute`: chạy `CompletenessAgent` → `render_interaction_prompt(assessment_code)` → `DeepSeekAdapter.chat(system, user)` → gộp JSON thêm key `llm_assistant`.

### 5.3. Prompt

- Loader: `AI-engine/app/infrastructure/prompts/loader.py` — placeholder `{{field}}` từ `InteractionSpec`; **`InteractionSpec.system_prompt`** từ Postgres (`SMARTWEALTH_INTERACTION_CATALOG_SOURCE=postgres`) hoặc snapshot (`…=snapshot`).

### 5.4. Bật LLM

- `Settings`: `assessment_llm_enabled`, `deepseek_api_key`, `deepseek_base_url`, `deepseek_model`.
- `build_onboarding_completeness_orchestrator` chọn agent theo flag + key.

---

## 6. Mở rộng: interaction / assessment mới

### 6.1. Chỉ thêm metadata (catalog)

1. Thêm giá trị vào `AssessmentCode` (enum) nếu cần id mới; thêm / sửa entry trong `catalog_seed.py` (hoặc chỉnh DB), seed DB, reload catalog (`reload_interaction_catalog`).
2. Thêm enum trong `AI-engine/app/orchestration/assessment/codes.py` nếu cần tên hằng.

### 6.2. Thêm prompt template

1. Đặt **`loop_input`** + **`system_prompt`** trong DB (`ai_interaction`), hoặc sửa `catalog_seed.py` rồi chạy `scripts/seed_ai_interaction_catalog.py`.
2. Dùng cùng placeholder như spec (`interaction_id`, `journey_phase`, …).

### 6.3. Thêm pipeline chạy được (runner)

1. Implement hàm runner `(conn, request_id) -> AIResult` hoặc tái dùng loader + orchestrator mới.
2. `register_assessment_runner(AssessmentCode.XXX.value, runner)` trong `ensure_builtin_assessment_runners` hoặc gọi đăng ký khi bootstrap.

### 6.4. Pipeline checklist mới (khác onboarding_completeness)

1. Tách module kiểu `onboarding_completeness.py`: `PolicyChecker` / `AgentSelector` / `ConfidenceGate` riêng.
2. Implement `Agent` mới (`agent_id` duy nhất) hoặc **tái dùng** executor + nhiều agent trong `LocalAgentExecutor`.
3. Giữ **`assessment_code`** là khóa routing ổn định cho audit và DB.

### 6.5. Gắn LLM cho interaction khác

- Pattern hiện tại: agent đọc `context.assessment_code`, gọi `render_interaction_prompt`.
- Tránh nhét HTTP client vào domain thuần; adapter đặt dưới `AI-engine/app/infrastructure/llm/`.

---

## 7. Cấu hình & chạy thử

| Biến / file | Mục đích |
|-------------|----------|
| `.env` / `.env.example` | DB, `INTERNAL_WORKFLOW_EVENT_TOKEN`, DeepSeek, `ASSESSMENT_LLM_ENABLED`. |
| `AI-engine/scripts/try_deepseek_prompt.py` | Thử prompt + DeepSeek không cần full DB. |
| `AI-engine/scripts/assessment_test_server.py` | Demo HTTP; truyền `Settings()` để respect `.env`. |

Internal assessment cần DB + schema/seed (xem `AI-engine/scripts/sql/` và [`AI-engine/docs/endpoint.md`](endpoint.md)).

---

## 8. Test & chất lượng

- Chạy: `cd AI-engine && pytest` (cấu hình trong `AI-engine/pyproject.toml`: `testpaths`, `pythonpath`), hoặc `pytest AI-engine/tests/unit` nếu chỉ định đường dẫn test (khi đó cần `PYTHONPATH=AI-engine` tuỳ môi trường).
- Agent đơn lẻ: mock LLM (xem `AI-engine/tests/unit/test_completeness_llm_agent.py`).
- Orchestrator: stub `ContextDataRepository` (`AI-engine/tests/unit/test_onboarding_completeness_orchestrator.py`).
- Prompt: `AI-engine/tests/unit/test_prompt_templates.py`.

Khi sửa domain model (`OrchestrationContext`, …), cập nhật mọi chỗ construct context trong test hoặc resolver.

---

## 9. Lộ trình học cho người mới

**Ngày 1 — Khung việc**

1. Đọc `README.md` (invariants).
2. Đọc `AI-engine/app/domain/smartwealth/interfaces/ports.py` — phân biệt Orchestrator / Agent / Tool / Resolver.
3. Đọc `interaction_catalog.py`, `catalog_seed.py` và bảng `ai_interaction` — hiểu các mã `AssessmentCode` / catalog là gì.

**Ngày 2 — Luồng assessment**

1. `internal_assessment.py` → `assessment_execute_service.py` → `assessment_pg.py`.
2. `sql_orchestration_request_loader.py` + `context_resolver.py`.
3. `orchestrator.py` (7 bước) → `completeness_agent.py`.

**Ngày 3 — Mở rộng & vận hành**

1. `onboarding_completeness.py` + `registry.py`.
2. `completeness_llm_agent.py` + `deepseek_adapter.py` + `app/infrastructure/prompts/loader.py`.
3. `workflow_ai_event_processor.py` nếu làm queue.

**Thói quen maintain**

- Ưu tiên **một thay đổi một PR nhỏ**: catalog → runner → agent.
- Giữ **assessment_code** khớp DB trigger và product matrix.
- Logic nghiệp vụ nặng → agent hoặc service tầng application; route HTTP mỏng.
- Sau khi sửa prompt, cập nhật **`system_prompt`** trong JSON spec và/hoặc DB (seed hoặc admin API).

---

*Nếu nội dung lệch code (refactor sau này), cập nhật guide này cùng PR refactor.*
