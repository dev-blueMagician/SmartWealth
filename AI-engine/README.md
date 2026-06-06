# SmartWealth AI Orchestration Core

State-driven orchestration baseline for bank-grade AI workflows.

**Coding guide (luồng code, mở rộng, onboarding):** [docs/CODING_GUIDE.md](docs/CODING_GUIDE.md)

## Core invariants

- State-driven, not request-driven.
- Single Source of Truth (SSOT) state repository only.
- AI can draft, but cannot finalize decisions.
- Every AI and tool output is auditable.
- Explicit boundary: Orchestrator != Agent != Tool.
- Explicit code paths only; no hidden behavior.

## Architecture

Source lives under **`AI-engine/`** (`PYTHONPATH` should include that directory when running uvicorn or scripts).

- `AI-engine/app/orchestration/smartwealth/graph.py`
  - State machine coordinator.
  - Applies transitions by current state.
- `AI-engine/app/orchestration/smartwealth/agents/`
  - Stateless AI-oriented step handlers.
- `AI-engine/app/tools/`
  - Deterministic helper logic for state lookups.
- `AI-engine/app/application/services/workflow_service.py`
  - Use-case boundary for API layer.
- `AI-engine/app/infrastructure/state/postgres_state_repository.py`
  - Workflow state persistence (PostgreSQL).
- `AI-engine/app/adapters/audit/postgres_audit_logger.py`
  - Append-only workflow audit log (PostgreSQL), bảng `workflow_audit_event` (cột khớp `PostgresAuditLogger`). Workflow HTTP dùng thêm `workflow_state` (`PostgresStateRepository`). Repo không ship file DDL riêng tên `workflow_tables.sql`; có thể lấy schema tương thích từ backend (`WorkflowAuditEventEntity`) hoặc tạo DDL tối thiểu theo các file adapter trên.

## Workflow event source (important)

Workflow events are emitted by backend business services when
a valid state transition is committed to the SSOT.

This system does NOT:
- poll database tables
- scan records
- expose AI use cases as APIs

The AI orchestrator only reacts to explicit workflow state-change events.

## Workflow states

- `RECEIVED`
- `VALIDATED`
- `DRAFTED`
- `PENDING_HUMAN_APPROVAL`
- `HUMAN_APPROVED`
- `HUMAN_REJECTED`

The orchestrator only progresses forward and stops at `PENDING_HUMAN_APPROVAL`.
Only explicit human action can move a workflow to `HUMAN_APPROVED` or `HUMAN_REJECTED`.

## Internal workflow control endpoints (non-AI)

These endpoints do NOT represent AI interfaces.

They are internal workflow control surfaces used to:
- create workflow records
- acknowledge state transitions
- resume orchestration after a human decision

AI execution is never triggered directly by API calls.

- `POST /api/v1/workflows`
  - Create workflow with initial payload.
- `POST /api/v1/workflows/{workflow_id}/run`
  - Run orchestrator until next human gate.
- `GET /api/v1/workflows/{workflow_id}`
  - Read full state snapshot.
- `GET /api/v1/workflows/{workflow_id}/audit-events`
  - Read complete audit trail.
- `POST /api/v1/workflows/{workflow_id}/human-approval`
  - Human approval/rejection action.
- `GET /api/v1/workflows`
  - Liệt kê workflow (giới hạn `limit`, mặc định 100).

**Bổ sung (Postgres queue + catalog, không thay phần trên):** phase → mã assessment công khai `GET /api/v1/case-phase-assessments` đọc bảng `case_phase` / `ai_interaction` sau khi chạy `python scripts/seed_ai_interaction_catalog.py` (DDL: `scripts/sql/ai_interaction_catalog_tables.sql` hoặc `scripts/sql/smartwealth.sql`). Seed/drain/gợi ý seed nội bộ trong [`docs/endpoint.md`](docs/endpoint.md).

## Sandbox vs production execution

In development and debugging environments, a sandbox runner
or internal trigger endpoint may be used to simulate workflow events.

In production:
- No AI use case is exposed as an API
- AI orchestration is triggered only by backend workflow events
- All AI runs are state- and policy-gated

## Domain rule policy

No business rules are embedded in this baseline.
Add institution-specific rules in dedicated modules after explicit requirement approval.
