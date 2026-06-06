# SmartWealth Frontend (Internal Portal)

Vite + React 19 + TypeScript + Tailwind CSS — UI nội bộ cho RM, WM, IM, Admin quản lý case
khách hàng và tích hợp AI-engine.

> Đây là **portal nội bộ** (JWT user-based). Cho developer portal đối tác bên ngoài,
> xem `frontend-openapi/`.

## Tính năng chính

- **Case Management** — tạo case (RM), xem danh sách, chi tiết, chuyển phase.
- **Planning Workspace** — tạo plan, chạy draft, tạo recommendation (WM).
- **Decision Gate** — approve/reject recommendation (Client mobile).
- **Execution Console** — tạo instruction, gửi, ghi nhận kết quả (IM/Admin).
- **Copilot Chat** — AI chat gắn case (agent/planner mode), đính kèm tài liệu.
- **Workflow** — xem/quản lý AI-engine workflow state (list + detail + seed).
- **AI Engine Admin** — case phases, interactions catalog, LLM profiles.
- **User Management** — quản lý người dùng nội bộ.
- **Mobile Onboarding** — đăng ký, profile, goals & assets (Client).

## Tech stack

| Layer | Thư viện |
|-------|----------|
| Framework | React 19, React Router 7 |
| Build | Vite 6 |
| Styling | Tailwind CSS 4, tailwind-merge, clsx |
| Icons | Lucide React |
| Animation | Motion (Framer Motion successor) |
| AI helpers | @google/genai (Gemini — optional, dùng cho draft advice) |
| Auth | Firebase Auth |
| Markdown | react-markdown |

## Chạy local

```bash
cd frontend
npm install
cp .env.example .env.local   # tuỳ chỉnh biến môi trường
npm run dev                   # http://localhost:3000
```

Biến môi trường (`.env.local`):

| Biến | Mô tả |
|------|--------|
| `GEMINI_API_KEY` | (Tuỳ chọn) API key Gemini cho AI draft advice. Nếu không set, tính năng AI draft fallback sang manual. |

## Build production

```bash
npm run build
npm run preview
```

## Cấu trúc thư mục

```
frontend/src/
├── pages/
│   ├── Login.tsx
│   ├── internal/
│   │   ├── CaseList.tsx
│   │   ├── CaseCreation.tsx
│   │   ├── CaseDetail.tsx
│   │   ├── PlanningWorkspace.tsx
│   │   ├── ExecutionConsole.tsx
│   │   ├── CopilotChat.tsx
│   │   ├── WorkflowList.tsx
│   │   ├── WorkflowDetail.tsx
│   │   ├── UserManagement.tsx
│   │   └── ai-engine/
│   │       ├── AiEngineCasePhasesPage.tsx
│   │       ├── AiEngineInteractionsPage.tsx
│   │       └── AiEngineLlmProfilesPage.tsx
│   └── mobile/
│       ├── Onboarding.tsx
│       └── WealthGoalsAssets.tsx
├── auth/           # AuthContext, guards
├── services/       # gemini.ts, API clients
├── components/     # shared UI components
├── constants/      # workflow states, enums
└── lib/            # utils (cn, etc.)
```

## Quan hệ với các module khác

| Module | Vai trò |
|--------|---------|
| `backend/` | REST API (Spring Boot) — portal gọi qua `/api/*` |
| `AI-engine/` | AI orchestration — backend gọi, FE gọi qua backend proxy |
| `frontend-openapi/` | Developer portal cho đối tác bên ngoài (tách bạch) |
