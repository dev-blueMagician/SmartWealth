# Wealth Backend — API flow & curl guide

Base URL mặc định: `http://localhost:8090` (đổi nếu `server.port` trong `application.yml` khác).

**Điều kiện:** PostgreSQL đã migrate (Flyway), service đang chạy (`mvn spring-boot:run`).

**Gợi ý:** Cài `jq` để script tự gán `CLIENT_ID`, `CASE_ID`, … từ JSON response.

---

## Biến môi trường

```bash
export BASE=http://localhost:8090
```

---

## Flow end-to-end (theo thứ tự)

### Bước 1 — RM: khởi tạo case (entry point)

**Sample request:**

```json
{
  "clientName": "Nguyen Van A",
  "rmNote": "Demo onboarding — RM initiated"
}
```

```bash
curl -sS -X POST "$BASE/api/cases" \
  -H "Content-Type: application/json" \
  -d '{
    "clientName": "Nguyen Van A",
    "rmNote": "Demo onboarding — RM initiated"
  }'
```

**Sample response (UUID chỉ mang tính minh họa — response thật do DB sinh):**

```json
{
  "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "caseId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "onboardingTaskId": "c3d4e5f6-a7b8-9012-cdef-123456789012",
  "profileCompletionTaskId": "d4e5f6a7-b8c9-0123-def0-234567890123",
  "auditEventId": "e5f6a7b8-c9d0-1234-ef01-345678901234"
}
```

**Gán biến (sau khi chạy curl thật):**

```bash
STEP1=$(curl -sS -X POST "$BASE/api/cases" \
  -H "Content-Type: application/json" \
  -d '{"clientName":"Nguyen Van A","rmNote":"Demo onboarding"}')
export CLIENT_ID=$(echo "$STEP1" | jq -r '.clientId')
export CASE_ID=$(echo "$STEP1" | jq -r '.caseId')
echo "CLIENT_ID=$CLIENT_ID CASE_ID=$CASE_ID"
```

---

### (Tuỳ chọn) Invitation stub — không đổi state core

**Sample request:**

```json
{
  "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "channel": "EMAIL"
}
```

```bash
curl -sS -X POST "$BASE/api/invitations" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"channel\":\"EMAIL\"}"
```

**Sample response:**

```json
{
  "accepted": true,
  "message": "Invitation stub — core state unchanged."
}
```

---

### Bước 2a — Client: đăng ký mobile (ACTIVE + hoàn thành CLIENT_REGISTRATION)

**Sample request:**

```json
{
  "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "deviceId": "iphone-demo-001"
}
```

```bash
curl -sS -X POST "$BASE/mobile/register" \
  -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"deviceId\":\"iphone-demo-001\"}"
```

**Sample response:**

```json
{
  "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "ACTIVE",
  "completedTask": "CLIENT_REGISTRATION"
}
```

---

### Bước 2b — Client: cập nhật profile (hoàn thành PROFILE_COMPLETION)

**Sample request:**

```json
{
  "name": "Nguyen Van A",
  "riskProfile": "BALANCED",
  "residency": "VN"
}
```

```bash
curl -sS -X PUT "$BASE/clients/$CLIENT_ID/profile" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nguyen Van A",
    "riskProfile": "BALANCED",
    "residency": "VN"
  }'
```

**Sample response:**

```json
{
  "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "riskProfile": "BALANCED",
  "residency": "VN",
  "completedTask": "PROFILE_COMPLETION"
}
```

---

### Bước 2c — Discovery: asset & goal (chỉ lưu, không quyết định)

**Asset — sample:**

```bash
curl -sS -X POST "$BASE/clients/$CLIENT_ID/assets" \
  -H "Content-Type: application/json" \
  -d '{"assetType":"CASH","value":150000000}'
```

**Goal — sample:**

```bash
curl -sS -X POST "$BASE/clients/$CLIENT_ID/goals" \
  -H "Content-Type: application/json" \
  -d '{"goalType":"RETIREMENT","targetAmount":5000000000}'
```

---

### Bước 2d — Discovery check → phase `PLANNING`, status `READY`

```bash
curl -sS -X POST "$BASE/cases/$CASE_ID/discovery/check"
```

**Sample response** (khớp `DiscoveryReadinessService`):

```json
{
  "caseId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "caseStatus": "READY",
  "message": "Case moved to PLANNING and marked READY."
}
```

---

### Bước 3a — WM: tạo financial plan (DRAFT, v1)

**Sample request:**

```json
{
  "note": "Initial WM draft — sample"
}
```

```bash
STEP_PLAN=$(curl -sS -X POST "$BASE/clients/$CLIENT_ID/plans" \
  -H "Content-Type: application/json" \
  -d '{"note":"Initial WM draft — sample"}')
export PLAN_ID=$(echo "$STEP_PLAN" | jq -r '.id')
echo "PLAN_ID=$PLAN_ID"
echo "$STEP_PLAN" | jq .
```

**Sample response (rút gọn):**

```json
{
  "id": "f6a7b8c9-d0e1-2345-f012-456789012345",
  "clientId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "status": "DRAFT",
  "versionNo": 1,
  "approved": false,
  "content": { "seedNote": "Initial WM draft — sample" },
  "createdAt": "2026-05-03T12:00:00Z"
}
```

---

### Bước 3b — WM: chạy draft calculation (placeholder)

**Sample request:**

```json
{
  "scenarioKey": "BASE_CASE",
  "assumptions": {
    "inflation": 0.035,
    "horizonYears": 20
  }
}
```

```bash
curl -sS -X POST "$BASE/plans/$PLAN_ID/draft" \
  -H "Content-Type: application/json" \
  -d '{
    "scenarioKey": "BASE_CASE",
    "assumptions": {"inflation": 0.035, "horizonYears": 20}
  }' | jq .
```

---

### Bước 3c — WM: tạo recommendation  
(`planVersionId` = `financial_plan.id`)

**Sample request:**

```json
{
  "recType": "ALLOCATION",
  "summary": "Sample 60/40 equity vs fixed income til risk profile BALANCED."
}
```

```bash
STEP_REC=$(curl -sS -X POST "$BASE/plans/$PLAN_ID/recommendations" \
  -H "Content-Type: application/json" \
  -d '{
    "recType": "ALLOCATION",
    "summary": "Sample 60/40 equity vs fixed income til risk profile BALANCED."
  }')
export RECOMMENDATION_ID=$(echo "$STEP_REC" | jq -r '.id')
echo "RECOMMENDATION_ID=$RECOMMENDATION_ID"
echo "$STEP_REC" | jq .
```

---

### Bước 4 — Client: decision gate (APPROVED)

**Sample request:**

```json
{
  "decisionStatus": "APPROVED"
}
```

```bash
curl -sS -X POST "$BASE/recommendations/$RECOMMENDATION_ID/decision" \
  -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED"}' | jq .
```

*(Thử từ chối: `"decisionStatus":"REJECTED"` — execution phía sau sẽ không hợp lệ với rule hiện tại.)*

---

### Bước 5 — IM: tạo execution instruction (DRAFT)

**Sample request:**

```json
{
  "recommendationId": "11111111-2222-3333-4444-555555555555",
  "note": "Pre-execution instruction — sample",
  "payload": {
    "strategy": "CORE_SATELLITE",
    "maxCashDragPercent": 5
  }
}
```

```bash
STEP_IX=$(curl -sS -X POST "$BASE/execution/instructions" \
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
echo "$STEP_IX" | jq .
```

---

### Bước 6a — Admin: gửi instruction (SENT)

**Sample request:**

```json
{
  "instructionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
}
```

```bash
curl -sS -X POST "$BASE/execution/send" \
  -H "Content-Type: application/json" \
  -d "{\"instructionId\":\"$INSTRUCTION_ID\"}" | jq .
```

---

### Bước 6b — Admin: ghi nhật kết quả + allocation (EXECUTED)

**Sample request:**

```json
{
  "instructionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "allocations": [
    { "assetClass": "EQUITY", "percentage": 60 },
    { "assetClass": "FIXED_INCOME", "percentage": 35 },
    { "assetClass": "CASH", "percentage": 5 }
  ]
}
```

```bash
curl -sS -X POST "$BASE/execution/results" \
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

**Sample response (rút gọn):**

```json
{
  "instructionId": "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  "instructionStatus": "EXECUTED",
  "portfolioId": "77777777-8888-9999-aaaa-bbbbbbbbbbbb",
  "message": "Portfolio updated; instruction EXECUTED."
}
```

---

## Script một lần chạy hết (cần `jq` + server đang up)

Lưu và chạy: `bash endpoint-flow.sh` hoặc copy nguyên khối dưới.

```bash
#!/usr/bin/env bash
set -euo pipefail
BASE="${BASE:-http://localhost:8090}"

STEP1=$(curl -sS -X POST "$BASE/api/cases" -H "Content-Type: application/json" \
  -d '{"clientName":"Nguyen Van A","rmNote":"Full demo flow"}')
CLIENT_ID=$(echo "$STEP1" | jq -r '.clientId')
CASE_ID=$(echo "$STEP1" | jq -r '.caseId')
echo "== Step 1 OK client=$CLIENT_ID case=$CASE_ID"

curl -sS -X POST "$BASE/mobile/register" -H "Content-Type: application/json" \
  -d "{\"clientId\":\"$CLIENT_ID\",\"deviceId\":\"demo-device\"}" | jq .

curl -sS -X PUT "$BASE/clients/$CLIENT_ID/profile" -H "Content-Type: application/json" \
  -d '{"name":"Nguyen Van A","riskProfile":"BALANCED","residency":"VN"}' | jq .

curl -sS -X POST "$BASE/clients/$CLIENT_ID/assets" -H "Content-Type: application/json" \
  -d '{"assetType":"CASH","value":150000000}' | jq .
curl -sS -X POST "$BASE/clients/$CLIENT_ID/goals" -H "Content-Type: application/json" \
  -d '{"goalType":"RETIREMENT","targetAmount":5000000000}' | jq .

curl -sS -X POST "$BASE/cases/$CASE_ID/discovery/check" | jq .

STEP_PLAN=$(curl -sS -X POST "$BASE/clients/$CLIENT_ID/plans" -H "Content-Type: application/json" \
  -d '{"note":"WM draft"}')
PLAN_ID=$(echo "$STEP_PLAN" | jq -r '.id')
echo "== Plan $PLAN_ID"

curl -sS -X POST "$BASE/plans/$PLAN_ID/draft" -H "Content-Type: application/json" \
  -d '{"scenarioKey":"BASE","assumptions":{"inflation":0.03}}' | jq .

STEP_REC=$(curl -sS -X POST "$BASE/plans/$PLAN_ID/recommendations" -H "Content-Type: application/json" \
  -d '{"recType":"ALLOCATION","summary":"60/35/5 sample split"}')
RECOMMENDATION_ID=$(echo "$STEP_REC" | jq -r '.id')
echo "== Recommendation $RECOMMENDATION_ID"

curl -sS -X POST "$BASE/recommendations/$RECOMMENDATION_ID/decision" -H "Content-Type: application/json" \
  -d '{"decisionStatus":"APPROVED"}' | jq .

STEP_IX=$(curl -sS -X POST "$BASE/execution/instructions" -H "Content-Type: application/json" \
  -d "{\"recommendationId\":\"$RECOMMENDATION_ID\",\"note\":\"IM draft\",\"payload\":{\"run\":\"demo\"}}")
INSTRUCTION_ID=$(echo "$STEP_IX" | jq -r '.id')
echo "== Instruction $INSTRUCTION_ID"

curl -sS -X POST "$BASE/execution/send" -H "Content-Type: application/json" \
  -d "{\"instructionId\":\"$INSTRUCTION_ID\"}" | jq .

curl -sS -X POST "$BASE/execution/results" -H "Content-Type: application/json" \
  -d "{\"instructionId\":\"$INSTRUCTION_ID\",\"allocations\":[
    {\"assetClass\":\"EQUITY\",\"percentage\":60},
    {\"assetClass\":\"FIXED_INCOME\",\"percentage\":35},
    {\"assetClass\":\"CASH\",\"percentage\":5}
  ]}" | jq .

echo "== Flow completed."
```

---

## Tham chiếu nhanh endpoint

| Phase | Method | Path |
|-------|--------|------|
| 1 RM | POST | `/api/cases` |
| 1 RM | POST | `/api/invitations` |
| 2 Client | POST | `/mobile/register` |
| 2 Client | PUT | `/clients/{clientId}/profile` |
| 2 Client | POST | `/clients/{clientId}/assets` |
| 2 Client | POST | `/clients/{clientId}/goals` |
| 2 Client | POST | `/cases/{caseId}/discovery/check` |
| 3 WM | POST | `/clients/{clientId}/plans` |
| 3 WM | POST | `/plans/{planId}/draft` |
| 3 WM | POST | `/plans/{planVersionId}/recommendations` |
| 4 Client | POST | `/recommendations/{recommendationId}/decision` |
| 5 IM | POST | `/execution/instructions` |
| 6 Admin | POST | `/execution/send` |
| 6 Admin | POST | `/execution/results` |
| Chat | GET | `/api/cases/{caseId}/chat/thread` |
| Chat | GET | `/api/cases/{caseId}/chat/messages` |
| Chat | POST | `/api/cases/{caseId}/chat/messages` |
| Chat | POST | `/api/cases/{caseId}/chat/detect-intent` |
| Chat | POST | `/api/cases/{caseId}/chat/attachments` |
| Chat | PATCH | `/api/cases/{caseId}/chat/attachments/{id}/status` |

Swagger UI: `$BASE/swagger-ui.html`

---

## Chat channel — curl samples

### Lấy / tạo thread

```bash
curl -sS "$BASE/api/cases/$CASE_ID/chat/thread" | jq .
```

Response:

```json
{
  "id": "<threadId>",
  "caseId": "<caseId>",
  "channel": "CASE_CHAT",
  "createdAt": "...",
  "updatedAt": "..."
}
```

### Gửi message + nhận AI reply

```bash
THREAD_ID="<from above>"

curl -sS -X POST "$BASE/api/cases/$CASE_ID/chat/messages" \
  -H "Content-Type: application/json" \
  -d "{
    \"threadId\": \"$THREAD_ID\",
    \"message\": \"Tôi muốn review kế hoạch nghỉ hưu\",
    \"visibility\": \"ALL\",
    \"autoDetectIntent\": true
  }" | jq .
```

### Detect intent (không gửi message)

```bash
curl -sS -X POST "$BASE/api/cases/$CASE_ID/chat/detect-intent" \
  -H "Content-Type: application/json" \
  -d "{
    \"threadId\": \"$THREAD_ID\",
    \"message\": \"Tôi muốn thêm tài sản mới\"
  }" | jq .
```

### Upload attachment

```bash
curl -sS -X POST "$BASE/api/cases/$CASE_ID/chat/attachments" \
  -F "file=@/path/to/document.pdf" \
  -F "docKind=ID_CARD" | jq .
```

### Liệt kê messages

```bash
curl -sS "$BASE/api/cases/$CASE_ID/chat/messages?threadId=$THREAD_ID" | jq .
```
