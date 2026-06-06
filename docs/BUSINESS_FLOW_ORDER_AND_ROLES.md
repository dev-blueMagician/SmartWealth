# Luồng nghiệp vụ Wealth Core — thứ tự & vai trò

Tài liệu **tham chiếu nhanh** thứ tự các bước bắt buộc/trên FE-demo và **role** gắn với từng bước. Chi tiết curl và AI-engine xem `docs/ONBOARDING_INTEGRATION_FLOW.md` và `backend/docs/endpoint.md`. Quy tắc phát triển chung: `docs/DEVELOPMENT_GUIDE.md`.

---

## Thứ tự chuẩn (backend gates)

| # | Bước | Role | API / hành động chính | Ghi chú gate |
|---|------|------|------------------------|--------------|
| 1 | Tạo case | **RM** | `POST /api/cases` | Trả `caseId`, `clientId`. |
| 2 | Đăng ký thiết bị | **Client** (mobile) | `POST /mobile/register` | Client → **ACTIVE** (điều kiện discovery). |
| 3 | Cập nhật profile | **Client** (mobile) | `PUT /clients/{clientId}/profile` | Hoàn task **PROFILE_COMPLETION** (điều kiện discovery). |
| 4 | *(Khuyến nghị sample)* Khai báo asset & goal | **Client** (mobile) | `POST /clients/{clientId}/assets`, `POST /clients/{clientId}/goals` | Trong script onboarding đầy đủ; không phải điều kiện trực tiếp trong `DiscoveryReadinessService` nhưng là phần “discovery data”. |
| 5 | Discovery check | **RM / System** (gọi API) | `POST /cases/{caseId}/discovery/check` | Case → **phase `PLANNING`**, **status `READY`** khi client ACTIVE + PROFILE_COMPLETION xong. |
| 6 | Tạo draft financial plan | **WM** | `POST /clients/{clientId}/plans` | Yêu cầu case ở phase planning và status phù hợp nghiệp vụ (sau bước 5: `PLANNING` + `READY`). |
| 7 | *(Tuỳ demo)* Chạy draft calculation | **WM** | `POST /plans/{planId}/draft` | Stub tính toán / merge `content`. |
| 8 | Tạo recommendation | **WM** | `POST /plans/{planVersionId}/recommendations` | `planVersionId` = `financial_plan.id`. |
| 9 | Phê duyệt recommendation (decision gate) | **Client** (mobile) | `POST /recommendations/{recommendationId}/decision` body `decisionStatus: APPROVED` | Set plan **APPROVED** + `approved=true` — **bắt buộc trước** tạo execution instruction. |
| 10 | Tạo execution instruction | **IM** | `POST /execution/instructions` | Backend kiểm tra plan đã **APPROVED**. |
| 11 | Gửi instruction | **Admin** | `POST /execution/send` | Chỉ instruction **DRAFT**. |
| 12 | *(Hoàn tất)* Ghi nhận kết quả execution | **Admin** | `POST /execution/results` | Instruction **SENT** → **EXECUTED**. |

---

## Vai trò tóm tắt

| Role | Giai đoạn trong bảng trên |
|------|---------------------------|
| **RM** | Khởi tạo case; có thể chạy discovery check. |
| **Client** | Đăng ký, profile (và thường kèm assets/goals trong sample); **approve/reject** recommendation. |
| **WM** | Tạo plan draft, chạy draft calc, tạo recommendation. |
| **IM** | Tạo execution instruction. |
| **Admin** | Gửi instruction, ghi nhận kết quả. |

---

## Hai điểm gate quan trọng (tránh lỗi khi demo)

1. **WM planning** chỉ sau discovery check thành công — case **phase `PLANNING`**, **status `READY`** (client ACTIVE + PROFILE_COMPLETION completed).
2. **Tạo execution instruction** chỉ khi **financial plan** đã **APPROVED** — đạt được sau bước client **APPROVED** trên recommendation (`ClientDecisionGateService`).

---

## Chat channel (song song với flow chính)

Chat AI chạy **song song** ở mọi phase — không phải gate, không chặn luồng chính. Mỗi case có 1 thread (`CASE_CHAT`). AI-engine tự detect intent + chọn assessment phù hợp theo phase hiện tại.

- **Kiến trúc chi tiết:** `docs/CASE_CHAT_ARCHITECTURE.md`
- Endpoints: `GET/POST /api/cases/{caseId}/chat/thread|messages|messages/stream|detect-intent|attachments`
- Code: `backend/src/main/java/com/backend/wealth/cases/chat/`
- Visibility: `ALL` (khách + staff) | `INTERNAL` (chỉ staff)

---

## Tham chiếu mã

- Discovery readiness: `backend/src/main/java/com/backend/wealth/cases/service/DiscoveryReadinessService.java`
- Gate WM plan tạo mới: `backend/src/main/java/com/backend/wealth/plan/service/WmPlanningService.java`
- Approve plan qua decision: `backend/src/main/java/com/backend/wealth/decision/service/ClientDecisionGateService.java`
- Gate execution instruction: `backend/src/main/java/com/backend/wealth/execution/service/ExecutionLifecycleService.java`
- Chat channel: `backend/src/main/java/com/backend/wealth/cases/chat/CaseChatController.java`
