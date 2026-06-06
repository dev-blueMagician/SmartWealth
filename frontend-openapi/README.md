# SmartWealth — Developer / Integration Portal (`frontend-openapi`)

Trang docs riêng cho **AI Engine Integration**: kể chuyện theo luồng (guides) +
API Reference live (OpenAPI 3.1) + Webhooks + Errors. Mục tiêu là làm "bộ mặt"
cho đối tác bên ngoài tích hợp với SmartWealth, **tách bạch** với portal nội bộ
và admin AI catalog.

> Đây là một SPA độc lập (Vite + React + TypeScript + Tailwind). Không phụ
> thuộc vào `frontend/` của portal. Có thể deploy riêng (subdomain
> `developers.smartwealth...`) hoặc nhúng vào portal qua reverse proxy.

## Tính năng

- **Layout 3 cột**: TopBar (env switcher + language switcher + search) · Sidebar group · Content · Right rail (TOC).
- **Guides theo luồng** với sequence diagram (Mermaid), tabs code (curl / TypeScript / Java / Python), bảng error. Bao gồm: onboarding, discovery, plan, decision, execution, AI catalog, **chat channel**.
- **API Reference live** dùng [Stoplight Elements] đọc từ `public/openapi/integration.yaml`.
- **Concepts** (case & workflow, catalog SSOT, idempotency).
- **Webhooks** (signature, retry timeline).
- **Errors** chuẩn hoá.
- **Env switcher**: Sandbox / Production — tự đổi base URL và token prefix trong mọi snippet.
- **Light theme** mặc định (nền sáng, typography slate), tokens trong `tailwind.config.js`.
- **i18n**: hỗ trợ EN / VI — switcher trên TopBar, lưu lựa chọn vào `localStorage`, dictionary tập trung tại `src/i18n/dict.ts`.

## Cấu trúc

```
frontend-openapi/
├── public/
│   ├── favicon.svg
│   └── openapi/
│       └── integration.yaml          # SSOT spec cho mặt phẳng /api/integration/v1
├── src/
│   ├── main.tsx                      # entry, mount HashRouter + EnvProvider
│   ├── App.tsx                       # routes
│   ├── env.tsx                       # context env (sandbox / production)
│   ├── nav.ts                        # cấu hình sidebar
│   ├── index.css                     # Tailwind + base styles
│   ├── components/
│   │   ├── Layout.tsx
│   │   ├── TopBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── RightRail.tsx
│   │   ├── EnvSwitcher.tsx
│   │   ├── LanguageSwitcher.tsx
│   │   ├── PageHeader.tsx
│   │   ├── CodeBlock.tsx
│   │   ├── CodeTabs.tsx
│   │   ├── Mermaid.tsx
│   │   ├── Callout.tsx
│   │   ├── ErrorTable.tsx
│   │   ├── EndpointPill.tsx
│   │   └── NextSteps.tsx
│   └── pages/
│       ├── Overview.tsx
│       ├── Authentication.tsx
│       ├── Quickstart.tsx
│       ├── ApiReference.tsx
│       ├── Webhooks.tsx
│       ├── Errors.tsx
│       ├── Changelog.tsx
│       ├── guides/
│       │   ├── OnboardingCase.tsx
│       │   ├── Discovery.tsx
│       │   ├── DiscoveryCheck.tsx
│       │   ├── PlanRecommendation.tsx
│       │   ├── DecisionExecution.tsx
│       │   ├── AiCatalog.tsx
│       │   └── ChatChannel.tsx
│       └── concepts/
│           ├── CaseWorkflow.tsx
│           ├── CatalogSsot.tsx
│           └── Idempotency.tsx
├── index.html
├── tailwind.config.js
├── postcss.config.js
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── package.json
```

## Chạy

```bash
cd frontend-openapi
npm install
npm run dev          # mặc định http://localhost:5180
```

Build production:

```bash
npm run build
npm run preview
```

## Tuỳ chỉnh

### 1. Đổi spec OpenAPI

Sửa file `public/openapi/integration.yaml` (hoặc thay bằng file auto-export từ
Springdoc theo group `integration`). Trang `/api-reference` sẽ tự load lại.

Gợi ý CI export từ backend Spring:

```yaml
# .github/workflows/openapi.yml (ví dụ)
- run: mvn springdoc:generate -Dspringdoc.group=integration
- run: cp target/openapi-integration.yaml frontend-openapi/public/openapi/integration.yaml
```

### 2. Đổi nội dung sidebar

Sửa `src/nav.ts` — đây là SSOT cho mọi link sidebar.

### 3. Đổi theme

Sửa tokens trong `tailwind.config.js` (`colors.bg`, `colors.accent`,...) và
`src/index.css`. Toàn bộ doc-card, sidebar, code block dùng các token này.

### 4. Thêm guide mới

1. Tạo file `src/pages/guides/MyNewGuide.tsx` (copy từ `OnboardingCase.tsx`).
2. Đăng ký route trong `src/App.tsx`.
3. Thêm vào sidebar trong `src/nav.ts`.

### 5. Thêm/sửa nội dung i18n

Tất cả text hiển thị nằm trong `src/i18n/dict.ts`. Mỗi page có một
namespace dưới `pages.<pageName>` chứa cùng cấu trúc cho `en` và `vi`.

- Đổi text → sửa trong `dict.ts`, cả `en` lẫn `vi` (TypeScript sẽ phát
  hiện ngay nếu mismatch).
- Thêm ngôn ngữ thứ 3: thêm key vào `dict` (ví dụ `ja`), thêm nhánh
  `LANGS` trong `LanguageSwitcher.tsx`.

### 6. Bật search ⌘K thật

Hiện `TopBar` chỉ là nút giả. Để tích hợp Algolia DocSearch:

```bash
npm i @docsearch/react @docsearch/css
```

Và thay phần search trong `src/components/TopBar.tsx`.

## Deploy

- **Subdomain riêng** (`developers.smartwealth.example`): build static rồi serve qua Nginx / S3+CloudFront / Vercel.
- **Subpath qua portal**: cấu hình reverse proxy ví dụ `/developer → frontend-openapi`. Vì dùng `HashRouter`, không cần SSR và không vướng routing 404 khi reload.

## Quan hệ với phần còn lại của repo

| Thành phần                         | Vai trò                                                |
| ---------------------------------- | ------------------------------------------------------ |
| `frontend/` (portal)               | UI nội bộ cho RM / admin (JWT user).                   |
| `backend/` (Spring)                | Business logic + admin AI catalog (`/api/admin/...`).  |
| `AI-engine/` (FastAPI)             | LLM orchestration, queue, assessments AI-xx.           |
| `frontend-openapi/` ← bạn đang đọc | Developer portal cho **đối tác bên ngoài**, machine-to-machine. |

> Khi backend dựng mặt phẳng `/api/integration/v1/...` thực sự (wrapper mỏng
> trên service nội bộ), file `public/openapi/integration.yaml` sẽ được auto-export
> từ Springdoc thay vì viết tay.

[Stoplight Elements]: https://github.com/stoplightio/elements
