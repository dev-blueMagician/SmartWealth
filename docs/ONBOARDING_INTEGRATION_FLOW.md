# Onboarding đầy đủ — Backend (Wealth Core) + AI-engine (Workflow Pattern A)

Tài liệu tổng hợp **luồng MVP Wealth Core** (theo spec PDF nội bộ) kết hợp **gọi trực tiếp API workflow** của AI-engine (`/api/v1/workflows`), không dùng event bus.

**Tham chiếu:**

- Backend: `backend/docs/endpoint.md`
- AI-engine workflow HTTP: `AI-engine/README.md`, `AI-engine/app/api/routes/workflow.py`
- AI-engine internal / assessment / queue / manifest phase→AI-xx: `AI-engine/docs/endpoint.md` (gồm `GET /api/v1/case-phase-assessments`, `GET /internal/workflow/orchestration-seed-hints/{workflow_id}`, `POST /internal/workflow/seed-fixtures`)
- Portal internal seed UI (preset queue states): `frontend/src/pages/internal/WorkflowDetail.tsx`, constants `frontend/src/constants/workflowQueueStates.ts`

---

## Điều kiện chạy sample

| Service | URL mặc định | Ghi chú |
|---------|----------------|---------|
| Wealth backend | `http://localhost:8090` | `backend/src/main/resources/application.yml` → `server.port` |
| AI-engine | `http://localhost:8010` | Ví dụ: `PYTHONPATH=AI-engine uvicorn app.main:app --host 0.0.0.0 --port 8000` |

Cài `jq` để script gán biến từ JSON response (tuỳ chọn).

---

## Biến môi trường (bash)

```bash
export BASE_BE=http://localhost:8090
export BASE_AI=http://localhost:8010
```

---

## Hai “đường ray” trong AI-engine (tránh nhầm)

| Đường ray | Endpoint | Vai trò trong sample này |
|-----------|----------|---------------------------|
| **Workflow HTTP (Pattern A)** | `/api/v1/workflows`, `/run`, `/human-approval` | Backend gọi trực tiếp sau các mốc nghiệp vụ. |
| **Internal / queue / assessment** | `/internal/workflow/*`, `/internal/assessment/execute`, `/api/v1/case-phase-assessments` | Luồng DB + token cho các route internal; catalog phase→assessment là **public** trên AI-engine — **không** nằm trong script curl sample bên dưới. |

---

## Luồng tích hợp (tóm tắt)

1. RM tạo case trên backend → backend (hoặc script) gọi AI-engine **tạo workflow** và lưu `workflow_id` gắn với case.
2. Client: register, profile, assets, goals — **chỉ backend**.
3. Discovery check trên backend → gọi AI-engine **`/run`** (validate/draft trong engine đến gate).
4. WM: plan, draft, recommendation — **chỉ backend**.
5. Client decision trên backend → gọi AI-engine **`/human-approval`** (map APPROVED/REJECTED).
6. IM + Admin: execution — **chỉ backend**.

---

## Sample — từng bước (curl)

### Bước 1 — RM: tạo case (backend)

```bash
STEP1=$(curl -sS -X POST "$BASE_BE/api/cases" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Nguyen Van A",
    "rmNote": "Demo onboarding — RM initiated"
  }')

export CLIENT_ID=$(echo "$STEP1" | jq -r '.clientId')
export CASE_ID=$(echo "$STEP1" | jq -r '.caseId')
echo "CLIENT_ID=$CLIENT_ID CASE_ID=$CASE_ID"
```

### Bước 1b — Tạo workflow trên AI-engine (Pattern A)

Payload nên mirror ngữ cảnh case để audit/debug; backend production nên persist `case_id ↔ workflow_id`.

```bash
STEP_WF=$(curl -sS -X POST "$BASE_AI/api/v1/workflows" \
  -H "Content-Type: application/json" \
  -d "{
    \"payload\": {
      \"case_id\": \"$CASE_ID\",
      \"client_id\": \"$CLIENT_ID\",
      \"client_name\": \"Nguyen Van A\",
      \"rm_note\": \"Demo onboarding — RM initiated\",
      \"phase\": \"CASE_CREATED\"
    }
  }")

export WORKFLOW_ID=$(echo "$STEP_WF" | jq -r '.workflow_id')
echo "WORKFLOW_ID=$WORKFLOW_ID"
echo "$STEP_WF" | jq .
```

Response gợi ý: `{"workflow_id":"<uuid>","status":"RECEIVED"}`.

---

### Bước 2 — Client: đăng ký, profile, discovery (backend only)

```bash
curl -sS -X POST "$BASE_BE/mobile/register" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"deviceId\":\"iphone-demo-001\"}" | jq .

curl -sS -X PUT "$BASE_BE/clients/$CLIENT_ID/profile" \
  -H "Content-Type: application/json" \
  -d '{"name":"Nguyen Van A","riskProfile":"BALANCED","residency":"VN"}' | jq .

curl -sS -X POST "$BASE_BE/clients/$CLIENT_ID/assets" \
  -H "Content-Type: application/json" \
  -d '{"assetType":"CASH","value":150000000}' | jq .

curl -sS -X POST "$BASE_BE/clients/$CLIENT_ID/goals" \
  -H "Content-Type: application/json" \
  -d '{"goalType":"RETIREMENT","targetAmount":5000000000}' | jq .
```

---

### Bước 3 — Discovery ready (backend) + chạy workflow (AI-engine)

**Backend — discovery xong: phase `PLANNING`, status `READY`** (`DiscoveryReadinessService.markDiscoveryReady`)

```bash
curl -sS -X POST "$BASE_BE/cases/$CASE_ID/discovery/check" | jq .
```

**AI-engine — chạy orchestrator đến human gate**

```bash
curl -sS -X POST "$BASE_AI/api/v1/workflows/$WORKFLOW_ID/run" | jq .
```

Response có thể kết thúc ở `PENDING_HUMAN_APPROVAL` và có `ai_draft` tuỳ logic validation/drafting trong engine.

---

### Bước 4 — WM: financial plan + draft + recommendation (backend only)

```bash
STEP_PLAN=$(curl -sS -X POST "$BASE_BE/clients/$CLIENT_ID/plans" \
  -H "Content-Type: application/json" \
  -d '{"note":"Initial WM draft — sample"}')

export PLAN_ID=$(echo "$STEP_PLAN" | jq -r '.id')
echo "PLAN_ID=$PLAN_ID"

curl -sS -X POST "$BASE_BE/plans/$PLAN_ID/draft" \
  -H "Content-Type: application/json" \
  -d '{"scenarioKey":"BASE_CASE","assumptions":{"inflation":0.035,"horizonYears":20}}' | jq .

STEP_REC=$(curl -sS -X POST "$BASE_BE/plans/$PLAN_ID/recommendations" \
  -H "Content-Type: application/json" \
  -d '{"recType":"ALLOCATION","summary":"Sample 60/40 equity vs fixed income for BALANCED."}')

export RECOMMENDATION_ID=$(echo "$STEP_REC" | jq -r '.id')
echo "RECOMMENDATION_ID=$RECOMMENDATION_ID"
echo "$STEP_REC" | jq .
```

---

### Bước 5 — Client: decision gate (backend) + human approval (AI-engine)

**Backend — quyết định theo PDF**

```bash
curl -sS -X POST "$BASE_BE/recommendations/$RECOMMENDATION_ID/decision" \
  -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED"}' | jq .
```

**AI-engine — map APPROVED → `approved: true`**

```bash
curl -sS -X POST "$BASE_AI/api/v1/workflows/$WORKFLOW_ID/human-approval" \
  -H "Content-Type: application/json" \
  -d "{
    \"approved\": true,
    \"reviewer_id\": \"client:$CLIENT_ID\",
    \"note\": \"APPROVED via recommendation decision gate\"
  }" | jq .
```

**Từ chối — ví dụ**

```bash
# curl -sS -X POST "$BASE_BE/recommendations/$RECOMMENDATION_ID/decision" \
#   -H "Content-Type: application/json" \
#   -d '{"decisionStatus":"REJECTED"}' | jq .

# curl -sS -X POST "$BASE_AI/api/v1/workflows/$WORKFLOW_ID/human-approval" \
#   -H "Content-Type: application/json" \
#   -d "{\"approved\": false, \"reviewer_id\": \"client:$CLIENT_ID\", \"note\": \"REJECTED via recommendation decision gate\"}" | jq .
```

---

### Bước 6 — IM: instruction + Admin: gửi + ghi nhận kết quả (backend only)

```bash
STEP_IX=$(curl -sS -X POST "$BASE_BE/execution/instructions" \
  -H "Content-Type: application/json" \
  -d "{
    \"recommendationId\": \"$RECOMMENDATION_ID\",
    \"note\": \"Pre-execution instruction — sample\",
    \"payload\": {
      \"strategy\": \"CORE_SATELLITE\",
      \"maxCashDragPercent\": 5
    }
  }")

export INSTRUCTION_ID=$(echo "$STEP_IX" | jq -r '.id')
echo "INSTRUCTION_ID=$INSTRUCTION_ID"

curl -sS -X POST "$BASE_BE/execution/send" \
  -H "Content-Type: application/json" \
  -d "{\"instructionId\":\"$INSTRUCTION_ID\"}" | jq .

curl -sS -X POST "$BASE_BE/execution/results" \
  -H "Content-Type: application/json" \
  -d "{
    \"instructionId\": \"$INSTRUCTION_ID\",
    \"allocations\": [
      {\"assetClass\":\"EQUITY\",\"percentage\":60},
      {\"assetClass\":\"FIXED_INCOME\",\"percentage\":35},
      {\"assetClass\":\"CASH\",\"percentage\":5}
    ]
  }" | jq .
```

---

## Script một lần (full flow)

Lưu ý: cần backend + AI-engine đang chạy; biến `BASE_BE`, `BASE_AI` đã export.

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE_BE="${BASE_BE:-http://localhost:8090}"
BASE_AI="${BASE_AI:-http://localhost:8010}"

STEP1=$(curl -sS -X POST "$BASE_BE/api/cases" -H "Content-Type: application/json" \
  -d '{"clientName":"Nguyen Van A","rmNote":"Full demo flow"}')
CLIENT_ID=$(echo "$STEP1" | jq -r '.clientId')
CASE_ID=$(echo "$STEP1" | jq -r '.caseId')
echo "== Step 1 OK client=$CLIENT_ID case=$CASE_ID"

STEP_WF=$(curl -sS -X POST "$BASE_AI/api/v1/workflows" -H "Content-Type: application/json" \
  -d "{\"payload\":{\"case_id\":\"$CASE_ID\",\"client_id\":\"$CLIENT_ID\",\"phase\":\"CASE_CREATED\"}}")
WORKFLOW_ID=$(echo "$STEP_WF" | jq -r '.workflow_id')
echo "== Workflow $WORKFLOW_ID"

curl -sS -X POST "$BASE_BE/mobile/register" -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"deviceId\":\"demo-device\"}" | jq .

curl -sS -X PUT "$BASE_BE/clients/$CLIENT_ID/profile" -H "Content-Type: application/json" \
  -d '{"name":"Nguyen Van A","riskProfile":"BALANCED","residency":"VN"}' | jq .

curl -sS -X POST "$BASE_BE/clients/$CLIENT_ID/assets" -H "Content-Type: application/json" \
  -d '{"assetType":"CASH","value":150000000}' | jq .
curl -sS -X POST "$BASE_BE/clients/$CLIENT_ID/goals" -H "Content-Type: application/json" \
  -d '{"goalType":"RETIREMENT","targetAmount":5000000000}' | jq .

curl -sS -X POST "$BASE_BE/cases/$CASE_ID/discovery/check" | jq .

curl -sS -X POST "$BASE_AI/api/v1/workflows/$WORKFLOW_ID/run" | jq .

STEP_PLAN=$(curl -sS -X POST "$BASE_BE/clients/$CLIENT_ID/plans" -H "Content-Type: application/json" \
  -d '{"note":"WM draft"}')
PLAN_ID=$(echo "$STEP_PLAN" | jq -r '.id')

curl -sS -X POST "$BASE_BE/plans/$PLAN_ID/draft" -H "Content-Type: application/json" \
  -d '{"scenarioKey":"BASE","assumptions":{"inflation":0.03}}' | jq .

STEP_REC=$(curl -sS -X POST "$BASE_BE/plans/$PLAN_ID/recommendations" -H "Content-Type: application/json" \
  -d '{"recType":"ALLOCATION","summary":"60/35/5 sample split"}')
RECOMMENDATION_ID=$(echo "$STEP_REC" | jq -r '.id')

curl -sS -X POST "$BASE_BE/recommendations/$RECOMMENDATION_ID/decision" -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED"}' | jq .

curl -sS -X POST "$BASE_AI/api/v1/workflows/$WORKFLOW_ID/human-approval" -H "Content-Type: application/json" \
  -d "{\"approved\":true,\"reviewer_id\":\"client:$CLIENT_ID\",\"note\":\"APPROVED\"}" | jq .

STEP_IX=$(curl -sS -X POST "$BASE_BE/execution/instructions" -H "Content-Type: application/json" \
  -d "{\"recommendationId\":\"$RECOMMENDATION_ID\",\"note\":\"IM draft\",\"payload\":{\"run\":\"demo\"}}")
INSTRUCTION_ID=$(echo "$STEP_IX" | jq -r '.id')

curl -sS -X POST "$BASE_BE/execution/send" -H "Content-Type: application/json" \
  -d "{\"instructionId\":\"$INSTRUCTION_ID\"}" | jq .

curl -sS -X POST "$BASE_BE/execution/results" -H "Content-Type: application/json" \
  -d "{\"instructionId\":\"$INSTRUCTION_ID\",\"allocations\":[
    {\"assetClass\":\"EQUITY\",\"percentage\":60},
    {\"assetClass\":\"FIXED_INCOME\",\"percentage\":35},
    {\"assetClass\":\"CASH\",\"percentage\":5}
  ]}" | jq .

echo "== Flow completed."
```

---

## Kiểm tra snapshot workflow (AI-engine)

```bash
curl -sS "$BASE_AI/api/v1/workflows/$WORKFLOW_ID" | jq .
curl -sS "$BASE_AI/api/v1/workflows/$WORKFLOW_ID/audit-events" | jq .
```

---

## Bảng tra cứu endpoint

| Phase | Role | Backend | AI-engine (Pattern A) |
|-------|------|---------|------------------------|
| 1 | RM | `POST /api/cases` | `POST /api/v1/workflows` |
| 2 | Client | `POST /mobile/register`, `PUT /clients/{id}/profile`, `POST /clients/{id}/assets`, `POST /clients/{id}/goals` | — |
| 2d | System | `POST /cases/{caseId}/discovery/check` | `POST /api/v1/workflows/{workflow_id}/run` |
| 3 | WM | `POST /clients/{clientId}/plans`, `POST /plans/{planId}/draft`, `POST /plans/{planId}/recommendations` | — |
| 4 | Client | `POST /recommendations/{id}/decision` | `POST /api/v1/workflows/{workflow_id}/human-approval` |
| 5–6 | IM / Admin | `POST /execution/instructions`, `POST /execution/send`, `POST /execution/results` | — |

---

## Ghi chú triển khai

- **Persist `workflow_id`**: lưu ở backend (cột trên case hoặc bảng mapping) để các bước sau gọi đúng AI-engine instance.
- **Retry / outbox**: gọi AI-engine nên có retry và không rollback transaction wealth nếu engine tạm lỗi (xử lý bất đồng bộ hoặc outbox nhẹ).
- **State workflow trong AI-engine**: `container.py` wiring hiện tại dùng **`PostgresStateRepository`** + **`PostgresAuditLogger`** — cần Postgres và bảng `workflow_state`, `workflow_audit_event` (xem `AI-engine/README.md`). Không có persistence thì tạo workflow/run sẽ lỗi kết nối DB.
