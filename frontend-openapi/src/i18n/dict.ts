// Source-of-truth dictionary for EN + VI.
// Two locales must keep identical shape — TypeScript will catch mismatches.

export type ErrorRowI18n = { code: string; reason: string; fix: string; http: number };

const common = {
  en: {
    copy: "Copy",
    copied: "Copied",
    next: "Next",
    nextSteps: "Next steps",
    onThisPage: "On this page",
    needHelp: "Need help?",
    contactBlurb: "Reach the Developer team via Slack or email",
    lastUpdated: "Last updated",
    search: "Search endpoints, guides, error codes…",
    searchAlert: "Search ⌘K (wire Algolia DocSearch in production)",
    systemsOk: "All systems operational",
    response: "Response",
    headers: "Headers",
    body: "Body",
    payload: "Payload",
    apiKey: "API key",
    oauth: "OAuth2 client credentials",
    sandbox: "Sandbox",
    production: "Production",
    tokenPrefix: "Token prefix",
    onboarded: "Onboarded via partner portal",
    minutes: (n: number) => `${n} min`,
    rateLimited: "rate-limited",
    idempotent: "idempotent",
    readonly: "read-only",
    atLeastOnce: "at-least-once",
    hmacSha256: "HMAC-SHA256",
    openapi31: "OpenAPI 3.1",
  },
  vi: {
    copy: "Sao chép",
    copied: "Đã chép",
    next: "Tiếp",
    nextSteps: "Bước tiếp theo",
    onThisPage: "Trên trang này",
    needHelp: "Cần hỗ trợ?",
    contactBlurb: "Liên hệ team Developer qua Slack hoặc email",
    lastUpdated: "Cập nhật lần cuối",
    search: "Tìm kiếm endpoint, guide, error code…",
    searchAlert: "Search ⌘K (gắn Algolia DocSearch khi dựng prod)",
    systemsOk: "Mọi dịch vụ hoạt động bình thường",
    response: "Phản hồi",
    headers: "Headers",
    body: "Body",
    payload: "Payload",
    apiKey: "API key",
    oauth: "OAuth2 client credentials",
    sandbox: "Sandbox",
    production: "Production",
    tokenPrefix: "Token prefix",
    onboarded: "Onboarded via partner portal",
    minutes: (n: number) => `${n} phút`,
    rateLimited: "có rate limit",
    idempotent: "idempotent",
    readonly: "chỉ đọc",
    atLeastOnce: "at-least-once",
    hmacSha256: "HMAC-SHA256",
    openapi31: "OpenAPI 3.1",
  },
};

const errors = {
  en: {
    headerCode: "Code",
    headerHttp: "HTTP",
    headerReason: "Reason",
    headerFix: "Resolution",
  },
  vi: {
    headerCode: "Mã lỗi",
    headerHttp: "HTTP",
    headerReason: "Lý do",
    headerFix: "Cách xử lý",
  },
};

const nav = {
  en: {
    groups: {
      getStarted: "Get started",
      guides: "Guides — integration flows",
      concepts: "Concepts",
      reference: "Reference",
    },
    items: {
      intro: "Introduction",
      auth: "Authentication",
      quickstart: "Quickstart",
      onboarding: "Onboarding case",
      discovery: "Submit discovery",
      discoveryCheck: "Discovery readiness (onboarding_completeness)",
      planRec: "Plan & recommendation",
      decisionExec: "Decision & execution",
      aiCatalog: "AI catalog (phase → catalog assessments)",
      chatChannel: "Chat channel",
      caseWorkflow: "Case & workflow",
      catalogSsot: "Catalog SSOT",
      idempotency: "Idempotency & retry",
      apiRef: "API Reference",
      webhooks: "Webhooks",
      errors: "Errors",
      changelog: "Changelog",
    },
  },
  vi: {
    groups: {
      getStarted: "Bắt đầu",
      guides: "Guides — luồng tích hợp",
      concepts: "Khái niệm",
      reference: "Tham chiếu",
    },
    items: {
      intro: "Giới thiệu",
      auth: "Xác thực",
      quickstart: "Quickstart",
      onboarding: "Onboarding case",
      discovery: "Gửi discovery",
      discoveryCheck: "Discovery readiness (onboarding_completeness)",
      planRec: "Plan & recommendation",
      decisionExec: "Decision & execution",
      aiCatalog: "AI catalog (phase → catalog assessments)",
      chatChannel: "Chat channel",
      caseWorkflow: "Case & workflow",
      catalogSsot: "Catalog SSOT",
      idempotency: "Idempotency & retry",
      apiRef: "API Reference",
      webhooks: "Webhooks",
      errors: "Lỗi (Errors)",
      changelog: "Changelog",
    },
  },
};

const overview = {
  en: {
    eyebrow: "Introduction",
    title: "SmartWealth AI Engine — Integration",
    description:
      "Integrate the onboarding → discovery → planning → execution flow with AI Engine. This site only documents the partner-facing surface, not internal admin APIs.",
    sandboxOpen: "Sandbox open",
    cards: {
      quickstart: {
        title: "Quickstart",
        desc: "Spin up sandbox and run a case end-to-end in 10 minutes.",
        cta: "Get started",
      },
      guides: {
        title: "Guides by flow",
        desc: "7 business flows: onboarding, discovery, plan, decision, execution, AI catalog, chat channel.",
        cta: "View guides",
      },
      apiRef: {
        title: "API Reference",
        desc: "Live OpenAPI viewer with try-it-out using a sandbox token.",
        cta: "Open reference",
      },
    },
    sec: {
      what: "What you can build",
      architecture: "Architecture",
      next: "Next",
    },
    whatItems: [
      "Create a customer case and link a workflow.",
      "Submit discovery data (assets, goals, profile) and trigger onboarding_completeness readiness.",
      "Create a plan, run draft computation, read recommendations.",
      "Submit decisions and send execution instructions.",
      "Read the AI catalog (case_phase → catalog assessments mapping).",
      "Integrate the AI chat channel — send messages, detect intent, attach documents.",
      "Receive webhooks on state changes (discovery ready, recommendation, execution).",
    ],
    archDescPrefix: "Partners only talk to ",
    archDescBold: "SmartWealth API",
    archDescBetween: " (the ",
    archDescCode: "/api/integration/v1",
    archDescAfter:
      " surface). The backend orchestrates Spring + AI-engine + Postgres SSOT internally — partners don’t need to know. Asynchronous events come back via ",
    archDescLink: "webhook",
    archCaption: "High-level: partner ↔ SmartWealth API ↔ AI-engine",
    nextCards: {
      auth: {
        title: "Authentication",
        desc: "API key & OAuth2 client credentials.",
      },
      webhooks: {
        title: "Webhooks",
        desc: "Schema, signature, retry policy.",
      },
    },
  },
  vi: {
    eyebrow: "Giới thiệu",
    title: "SmartWealth AI Engine — Integration",
    description:
      "Tích hợp luồng onboarding → discovery → planning → execution với AI-engine. Tài liệu này chỉ mô tả mặt phẳng đối tác (partner-facing), không bao gồm các API admin nội bộ.",
    sandboxOpen: "Sandbox mở",
    cards: {
      quickstart: {
        title: "Quickstart",
        desc: "Lên sandbox và chạy 1 case end-to-end trong 10 phút.",
        cta: "Bắt đầu",
      },
      guides: {
        title: "Guides theo luồng",
        desc: "7 luồng nghiệp vụ: onboarding, discovery, plan, decision, execution, AI catalog, chat channel.",
        cta: "Xem guides",
      },
      apiRef: {
        title: "API Reference",
        desc: "OpenAPI live, có thử nghiệm trực tiếp với token sandbox.",
        cta: "Mở reference",
      },
    },
    sec: {
      what: "Bạn có thể xây gì",
      architecture: "Kiến trúc",
      next: "Tiếp theo",
    },
    whatItems: [
      "Khởi tạo case khách hàng và link workflow.",
      "Đẩy dữ liệu discovery (assets, goals, profile) và trigger readiness onboarding_completeness.",
      "Tạo plan, draft tính toán, đọc recommendation.",
      "Submit decision và gửi execution instruction.",
      "Đọc AI catalog (mapping case_phase → catalog assessments).",
      "Tích hợp AI chat channel — gửi tin nhắn, detect intent, đính kèm tài liệu.",
      "Nhận webhook khi state thay đổi (discovery ready, recommendation, execution).",
    ],
    archDescPrefix: "Đối tác chỉ tương tác với ",
    archDescBold: "SmartWealth API",
    archDescBetween: " (lớp ",
    archDescCode: "/api/integration/v1",
    archDescAfter:
      "). Backend nội bộ điều phối Spring + AI-engine và Postgres SSOT, đối tác không cần biết chi tiết. Sự kiện trả về qua ",
    archDescLink: "webhook",
    archCaption: "Tổng quan: đối tác ↔ SmartWealth API ↔ AI-engine",
    nextCards: {
      auth: {
        title: "Authentication",
        desc: "API key & OAuth2 client credentials.",
      },
      webhooks: {
        title: "Webhooks",
        desc: "Schema, chữ ký, retry policy.",
      },
    },
  },
};

const authentication = {
  en: {
    eyebrow: "Get started",
    title: "Authentication",
    description:
      "Every request to /api/integration/v1 must carry machine-to-machine credentials. Two mechanisms are supported: API key (simple) or OAuth2 client credentials (recommended for production).",
    sec: {
      model: "Auth model",
      apiKey: "API key",
      oauth: "OAuth2 client credentials",
      rotation: "Rotation & revoke",
    },
    modelBody: (
      "Partners register in the Developer dashboard and receive a "
    ),
    modelBoldClient: "client_id",
    modelPlus: " + ",
    modelBoldSecret: "client_secret",
    modelOr: " (OAuth) or an ",
    modelBoldKey: "API key",
    modelEnd:
      ". All requests must use HTTPS. Store keys/secrets in a vault, never hardcode them in clients.",
    apiKeyBody1: "Add the header ",
    apiKeyHeaderCode: "Authorization: Bearer <key>",
    apiKeyBody2: ". Sandbox keys are prefixed ",
    apiKeyPrefixSandbox: "sk_sandbox_",
    apiKeyAnd: ", production ",
    apiKeyPrefixLive: "sk_live_",
    apiKeyEnd: ".",
    dontUseJwt: {
      title: "Don’t use the portal’s JWT",
      body:
        "An integration API key is different from end-user JWTs. Don’t reuse RM/portal access tokens for integration — those carry user scope, not partner scope.",
    },
    oauthIntro:
      "Tokens are short-lived (1h). Cache in memory and refresh 60s before expiry. In production prefer OAuth over a static API key.",
    rotationItems: [
      "Each partner can keep up to 2 keys at once for zero-downtime rotation.",
      "Revoke instantly in the Developer dashboard — fully audit-logged.",
      "Recommended rotation cadence: every 90 days.",
    ],
  },
  vi: {
    eyebrow: "Bắt đầu",
    title: "Xác thực",
    description:
      "Mọi request tới mặt phẳng /api/integration/v1 phải đính kèm credential machine-to-machine. Hỗ trợ 2 cơ chế: API key (đơn giản) và OAuth2 client credentials (khuyến nghị production).",
    sec: {
      model: "Mô hình auth",
      apiKey: "API key",
      oauth: "OAuth2 client credentials",
      rotation: "Rotate & revoke",
    },
    modelBody: "Đối tác đăng ký trong Developer dashboard, nhận ",
    modelBoldClient: "client_id",
    modelPlus: " + ",
    modelBoldSecret: "client_secret",
    modelOr: " (OAuth) hoặc ",
    modelBoldKey: "API key",
    modelEnd:
      ". Tất cả request đều phải gửi qua HTTPS. Lưu key/secret trong vault, không hardcode trong client.",
    apiKeyBody1: "Đính header ",
    apiKeyHeaderCode: "Authorization: Bearer <key>",
    apiKeyBody2: ". Sandbox key prefix ",
    apiKeyPrefixSandbox: "sk_sandbox_",
    apiKeyAnd: ", production ",
    apiKeyPrefixLive: "sk_live_",
    apiKeyEnd: ".",
    dontUseJwt: {
      title: "Đừng dùng JWT của portal",
      body:
        "API key tích hợp khác với JWT người dùng cuối. Đừng dùng access token của RM/portal cho integration — chúng có scope user, không phải scope partner.",
    },
    oauthIntro:
      "Token có TTL ngắn (1h). Cache trong bộ nhớ và refresh trước khi hết hạn 60s. Production nên dùng OAuth thay vì API key cố định.",
    rotationItems: [
      "Mỗi đối tác có thể giữ tối đa 2 key đồng thời để rotate không downtime.",
      "Revoke ngay trong Developer dashboard — có audit trail.",
      "Khuyến nghị rotate 90 ngày/lần.",
    ],
  },
};

const quickstart = {
  en: {
    eyebrow: "Get started",
    title: "Quickstart — onboarding case end-to-end",
    description:
      "10 minutes from creating a case → discovery → onboarding_completeness readiness. Sandbox is free, keys are valid for 30 days.",
    flowCaption: "Quickstart steps overview",
    sec: {
      step1: "1. Get a sandbox API key",
      step2: "2. Create a case",
      step3: "3. Submit discovery data",
      step4: "4. Trigger discovery readiness (onboarding_completeness)",
      step5: "5. Receive a webhook on state change",
    },
    step1Intro: "Open the Developer dashboard → ",
    step1Action: "Generate sandbox key",
    step1After: " → copy the ",
    step1Code: "<env.tokenPrefix>…",
    step1Final: " string. Set it as an environment variable:",
    idempotentNote:
      "You can call /discovery/check repeatedly — the endpoint is idempotent. Each call re-runs onboarding_completeness with the latest snapshot.",
    idempotentTitle: "Idempotent",
    nextOnboardingTitle: "Next: Plan & recommendation",
    nextOnboardingDesc: "After the case is READY, create a plan and read recommendations.",
    nextWebhookTitle: "Configure webhook signatures",
    nextWebhookDesc: "Verify signatures to secure callbacks.",
  },
  vi: {
    eyebrow: "Bắt đầu",
    title: "Quickstart — onboarding case end-to-end",
    description:
      "10 phút để chạy 1 case từ tạo mới → discovery → onboarding_completeness readiness. Sandbox không tốn phí, key dùng được trong 30 ngày.",
    flowCaption: "Tổng quan các bước Quickstart",
    sec: {
      step1: "1. Lấy API key sandbox",
      step2: "2. Tạo case",
      step3: "3. Đẩy dữ liệu discovery",
      step4: "4. Trigger discovery readiness (onboarding_completeness)",
      step5: "5. Nhận webhook khi state đổi",
    },
    step1Intro: "Vào Developer dashboard → ",
    step1Action: "Generate sandbox key",
    step1After: " → copy chuỗi ",
    step1Code: "<env.tokenPrefix>…",
    step1Final: ". Set vào biến môi trường:",
    idempotentNote:
      "Có thể gọi /discovery/check nhiều lần — endpoint là idempotent. Mỗi lần sẽ re-run onboarding_completeness với snapshot mới nhất.",
    idempotentTitle: "Idempotent",
    nextOnboardingTitle: "Tiếp theo: Plan & recommendation",
    nextOnboardingDesc: "Sau khi case READY, tạo plan và đọc recommendation.",
    nextWebhookTitle: "Cấu hình webhook signature",
    nextWebhookDesc: "Verify chữ ký để bảo mật callback.",
  },
};

const guideOnboarding = {
  en: {
    eyebrow: "Guides · Onboarding",
    title: "Create a new customer case",
    description:
      "Initialize a case with clientName + rmNote. The backend creates a client and workflow, and returns 3 IDs.",
    sec: {
      when: "When to use this",
      diagram: "Sequence diagram",
      prereq: "Prerequisites",
      step1: "Step 1 — Create case",
      step2: "Step 2 — Verify",
      errors: "Common errors",
    },
    whenBody:
      "When a partner needs to onboard a new customer that does not yet exist in SmartWealth. If a clientId already exists, jump straight to the Submit discovery flow.",
    prereqItems: [
      "API key with cases:write scope.",
      "Sandbox env or production depending on integration phase.",
    ],
    errors: [
      {
        code: "MISSING_REQUIRED_FIELD",
        http: 400,
        reason: "Missing clientName.",
        fix: "Send a non-empty clientName in the body.",
      },
      {
        code: "DUPLICATE_CLIENT",
        http: 409,
        reason: "clientName collides with an existing INITIALIZED case.",
        fix: "Pass an explicit clientId, or use /clients/{id} if the customer already exists.",
      },
      {
        code: "UNAUTHORIZED",
        http: 401,
        reason: "API key missing the cases:write scope.",
        fix: "Re-issue the key in the dashboard with proper scopes.",
      },
    ] as ErrorRowI18n[],
    nextDiscovery: {
      title: "Submit discovery",
      desc: "Push assets, goals, profile after creating the case.",
    },
    nextCheck: {
      title: "Trigger onboarding_completeness",
      desc: "Score completeness and get readiness back.",
    },
  },
  vi: {
    eyebrow: "Guides · Onboarding",
    title: "Tạo case khách hàng mới",
    description:
      "Khởi tạo case với clientName + rmNote. Backend tự sinh client và workflow tương ứng, trả về 3 ID.",
    sec: {
      when: "Khi nào dùng",
      diagram: "Sequence diagram",
      prereq: "Prerequisites",
      step1: "Step 1 — Tạo case",
      step2: "Step 2 — Verify",
      errors: "Lỗi thường gặp",
    },
    whenBody:
      "Khi đối tác cần khởi tạo một khách hàng mới vào SmartWealth (chưa tồn tại). Nếu đã có clientId trước đó, dùng luồng Submit discovery trực tiếp mà không cần tạo case mới.",
    prereqItems: [
      "API key có scope cases:write.",
      "Sandbox env hoặc production tuỳ giai đoạn tích hợp.",
    ],
    errors: [
      {
        code: "MISSING_REQUIRED_FIELD",
        http: 400,
        reason: "Thiếu clientName.",
        fix: "Đảm bảo body có clientName non-empty.",
      },
      {
        code: "DUPLICATE_CLIENT",
        http: 409,
        reason: "ClientName trùng với một case đang INITIALIZED.",
        fix: "Truyền clientId hoặc dùng endpoint /clients/{id} nếu đã có khách hàng.",
      },
      {
        code: "UNAUTHORIZED",
        http: 401,
        reason: "API key thiếu scope cases:write.",
        fix: "Cấp lại key trong dashboard với scope đúng.",
      },
    ] as ErrorRowI18n[],
    nextDiscovery: {
      title: "Submit discovery",
      desc: "Đẩy assets, goals, profile sau khi tạo case.",
    },
    nextCheck: {
      title: "Trigger onboarding_completeness",
      desc: "Chấm completeness và nhận readiness.",
    },
  },
};

const guideDiscovery = {
  en: {
    eyebrow: "Guides · Discovery",
    title: "Submit discovery — assets, goals, profile",
    description:
      "Push the customer data needed for onboarding_completeness to score onboarding completeness. You may batch or send sequentially.",
    sec: {
      when: "When to use this",
      diagram: "Sequence diagram",
      assets: "Assets",
      goals: "Goals",
      profile: "Profile",
      errors: "Errors",
    },
    whenBody:
      "After you have a clientId (from case creation or already present). Partners can split work in stages (assets first, then goals, …); AI-engine scores against the latest snapshot when readiness is invoked.",
    errors: [
      { code: "VALIDATION_FAILED", http: 400, reason: "Schema mismatch (e.g. value < 0).", fix: "Fix the payload to match the schema." },
      { code: "CLIENT_NOT_FOUND", http: 404, reason: "clientId does not exist.", fix: "Create the case first (Onboarding flow)." },
      { code: "RATE_LIMITED", http: 429, reason: "More than 100 req/min/key.", fix: "Backoff and batch." },
    ] as ErrorRowI18n[],
    nextCheck: { title: "Trigger onboarding_completeness readiness", desc: "Score completeness once data is in." },
    nextIdempotency: { title: "Understand idempotency", desc: "How to retry safely on network errors." },
  },
  vi: {
    eyebrow: "Guides · Discovery",
    title: "Submit discovery — assets, goals, profile",
    description:
      "Đẩy dữ liệu khách hàng cần thiết để onboarding_completeness chấm onboarding completeness. Có thể batch hoặc gọi tuần tự.",
    sec: {
      when: "Khi nào dùng",
      diagram: "Sequence diagram",
      assets: "Assets",
      goals: "Goals",
      profile: "Profile",
      errors: "Errors",
    },
    whenBody:
      "Sau khi đã có clientId (từ luồng tạo case hoặc đã tồn tại). Đối tác có thể chia nhỏ theo giai đoạn (lần 1 đẩy assets, lần 2 đẩy goals…), AI-engine sẽ chấm trên snapshot mới nhất khi gọi readiness.",
    errors: [
      { code: "VALIDATION_FAILED", http: 400, reason: "Schema sai (vd: value < 0).", fix: "Sửa payload theo schema." },
      { code: "CLIENT_NOT_FOUND", http: 404, reason: "clientId không tồn tại.", fix: "Tạo case trước (luồng Onboarding)." },
      { code: "RATE_LIMITED", http: 429, reason: "> 100 req/phút/key.", fix: "Backoff & batch." },
    ] as ErrorRowI18n[],
    nextCheck: { title: "Trigger onboarding_completeness readiness", desc: "Chấm completeness sau khi đã đẩy đủ data." },
    nextIdempotency: { title: "Hiểu idempotency", desc: "Cách retry an toàn khi network lỗi." },
  },
};

const guideDiscoveryCheck = {
  en: {
    eyebrow: "Guides · Discovery",
    title: "Trigger discovery readiness (onboarding_completeness)",
    description:
      "Ask AI-engine to score onboarding completeness. The endpoint returns caseStatus synchronously; an async webhook is also emitted so multiple downstream subscribers can listen.",
    sec: {
      when: "When to use this",
      diagram: "Sequence diagram",
      trigger: "Trigger check",
      ready: "READY response",
      missing: "MISSING_DATA response",
      errors: "Errors",
    },
    whenBody:
      "After all assets/goals/profile have been submitted for the client. Safe to call multiple times — each call re-runs on the latest snapshot. Typically takes 1–3 seconds depending on data size.",
    missingNote:
      "Just push the missing fields and call again. No need to retry on a schedule.",
    errors: [
      { code: "CASE_NOT_FOUND", http: 404, reason: "Wrong caseId.", fix: "Verify with /cases/{id}." },
      { code: "AI_TIMEOUT", http: 504, reason: "AI-engine took longer than 30s.", fix: "Retry after 5s; if it persists contact support." },
      { code: "ASSESSMENT_DISABLED", http: 503, reason: "Feature flag onboarding_completeness_enabled is OFF.", fix: "Contact SmartWealth admin." },
    ] as ErrorRowI18n[],
    nextPlan: { title: "Plan & recommendation", desc: "After READY, create a plan and read recommendations." },
    nextWebhook: { title: "Webhook signature", desc: "Verify the case.discovery.ready event." },
  },
  vi: {
    eyebrow: "Guides · Discovery",
    title: "Trigger discovery readiness (onboarding_completeness)",
    description:
      "Yêu cầu AI-engine chấm onboarding completeness. Endpoint đồng bộ trả về caseStatus; webhook async cũng được gửi để client subscribe nhiều downstream.",
    sec: {
      when: "Khi nào dùng",
      diagram: "Sequence diagram",
      trigger: "Trigger check",
      ready: "Trạng thái READY",
      missing: "Trạng thái MISSING_DATA",
      errors: "Errors",
    },
    whenBody:
      "Sau khi đẩy đủ assets/goals/profile cho client. Có thể gọi nhiều lần — mỗi lần re-run trên snapshot mới nhất. Endpoint thường mất 1–3 giây tuỳ kích thước data.",
    missingNote:
      "Đối tác chỉ cần đẩy thêm các missingFields rồi gọi lại endpoint. Không cần retry theo lịch.",
    errors: [
      { code: "CASE_NOT_FOUND", http: 404, reason: "caseId sai.", fix: "Verify từ /cases/{id}." },
      { code: "AI_TIMEOUT", http: 504, reason: "AI-engine chạy > 30s.", fix: "Retry sau 5s; nếu lặp lại liên hệ support." },
      { code: "ASSESSMENT_DISABLED", http: 503, reason: "Feature flag onboarding_completeness_enabled OFF.", fix: "Liên hệ admin SmartWealth." },
    ] as ErrorRowI18n[],
    nextPlan: { title: "Plan & recommendation", desc: "Sau khi READY, tạo plan và đọc recommendation." },
    nextWebhook: { title: "Webhook signature", desc: "Verify chữ ký event case.discovery.ready." },
  },
};

const guidePlanRec = {
  en: {
    eyebrow: "Guides · Planning",
    title: "Plan & recommendation lifecycle",
    description:
      "Create a plan for a client, run draft computation per scenario, then read or curate recommendations.",
    sec: {
      diagram: "Sequence diagram",
      create: "Create plan",
      draft: "Run draft",
      recs: "Read recommendations",
      createRec: "Create a recommendation",
    },
    nextDecision: { title: "Decision & execution", desc: "Approve a recommendation and create execution instructions." },
  },
  vi: {
    eyebrow: "Guides · Planning",
    title: "Plan & recommendation lifecycle",
    description:
      "Tạo plan cho client, chạy draft tính toán theo scenario, sau đó đọc/chỉnh recommendation.",
    sec: {
      diagram: "Sequence diagram",
      create: "Tạo plan",
      draft: "Run draft",
      recs: "Đọc recommendations",
      createRec: "Tạo recommendation",
    },
    nextDecision: { title: "Decision & execution", desc: "Approve recommendation và tạo execution instruction." },
  },
};

const guideDecisionExec = {
  en: {
    eyebrow: "Guides · Execution",
    title: "Decision & execution",
    description:
      "Approve a recommendation, generate an execution instruction, send it to downstream (core banking / broker). A webhook confirms delivery.",
    sec: {
      diagram: "Sequence diagram",
      decision: "Approve / reject",
      instruction: "Create execution instruction",
      send: "Send execution",
      errors: "Errors",
    },
    atLeastOnce: {
      title: "At-least-once delivery",
      body:
        "Webhooks may be retried multiple times. Use the event id as an idempotency key to dedupe.",
    },
    errors: [
      { code: "DECISION_ALREADY_APPLIED", http: 409, reason: "Recommendation already has a decision.", fix: "Create a new recommendation or read the current decision." },
      { code: "INSTRUCTION_NOT_DRAFT", http: 409, reason: "Instruction already SENT, can’t resend.", fix: "Create a new instruction." },
      { code: "DOWNSTREAM_REJECTED", http: 502, reason: "Core banking refused.", fix: "Inspect details.reason and handle business case." },
    ] as ErrorRowI18n[],
    nextWebhook: { title: "Webhook signature", desc: "Verify execution.sent event." },
    nextIdempotency: { title: "Idempotency", desc: "How to dedupe repeated webhooks." },
  },
  vi: {
    eyebrow: "Guides · Execution",
    title: "Decision & execution",
    description:
      "Approve recommendation, sinh execution instruction, gửi tới downstream (core banking / broker). Có webhook xác nhận.",
    sec: {
      diagram: "Sequence diagram",
      decision: "Approve / reject",
      instruction: "Tạo execution instruction",
      send: "Gửi execution",
      errors: "Errors",
    },
    atLeastOnce: {
      title: "At-least-once delivery",
      body:
        "Webhook có thể được gửi lại nhiều lần. Đối tác cần idempotency-key dùng id của event để dedupe.",
    },
    errors: [
      { code: "DECISION_ALREADY_APPLIED", http: 409, reason: "Recommendation đã có quyết định.", fix: "Tạo recommendation mới hoặc đọc decision hiện tại." },
      { code: "INSTRUCTION_NOT_DRAFT", http: 409, reason: "Instruction đã SENT, không gửi lại.", fix: "Tạo instruction mới." },
      { code: "DOWNSTREAM_REJECTED", http: 502, reason: "Core banking từ chối.", fix: "Đọc details.reason để xử lý nghiệp vụ." },
    ] as ErrorRowI18n[],
    nextWebhook: { title: "Webhook signature", desc: "Verify event execution.sent." },
    nextIdempotency: { title: "Idempotency", desc: "Cách dedupe webhook lặp." },
  },
};

const guideAiCatalog = {
  en: {
    eyebrow: "Guides · AI Catalog",
    title: "AI catalog — phase → catalog assessments",
    description:
      "Read the case_phase → catalog assessments mapping (read-only). Use it when partners need to know which assessment AI-engine will run at each stage of a case.",
    sec: {
      what: "Concept",
      diagram: "Diagram",
      list: "List the catalog",
      phase: "Read one phase",
      shape: "Data shape",
    },
    whatBody:
      "SmartWealth organises a case into phases (ONBOARDING, DISCOVERY, PLANNING, EXECUTION…). Each phase has 1+ catalog assessments assessments (e.g. onboarding_completeness onboarding completeness). The catalog is the SSOT in Postgres; partners can read the snapshot to understand the workflow.",
  },
  vi: {
    eyebrow: "Guides · AI Catalog",
    title: "AI catalog — phase → catalog assessments",
    description:
      "Đọc mapping case_phase → assessment catalog assessments (read-only). Dùng khi đối tác cần biết AI-engine sẽ chạy assessment nào ở mỗi giai đoạn của case.",
    sec: {
      what: "Khái niệm",
      diagram: "Diagram",
      list: "Liệt kê catalog",
      phase: "Đọc 1 phase",
      shape: "Cấu trúc dữ liệu",
    },
    whatBody:
      "SmartWealth tổ chức case theo các phase (ONBOARDING, DISCOVERY, PLANNING, EXECUTION…). Mỗi phase có 1+ assessment catalog assessments (ví dụ onboarding_completeness onboarding completeness). Catalog này là SSOT trong Postgres, đối tác có thể đọc snapshot để hiểu workflow.",
  },
};

const guideChatChannel = {
  en: {
    eyebrow: "Guides · Chat",
    title: "Chat channel integration",
    description:
      "Integrate the AI-powered chat channel into your application. Send messages on behalf of users, receive AI responses with intent detection, and attach documents for context-aware conversations.",
    sec: {
      when: "When to use this",
      diagram: "Sequence diagram",
      prereq: "Prerequisites",
      thread: "Get or create a thread",
      send: "Send a message",
      detectIntent: "Detect intent (optional pre-check)",
      attachments: "Attachments",
      visibility: "Visibility model",
      errors: "Common errors",
    },
    whenBody:
      "When a partner application embeds a chat experience that connects to SmartWealth AI-engine. The chat channel is tied to a case and follows the case lifecycle — AI responses are context-aware (phase, assessment, client profile).",
    prereqItems: [
      "API key with chat:write scope.",
      "A valid caseId (create via the Onboarding case flow).",
      "Sandbox or production env depending on integration phase.",
    ],
    threadBody:
      "Each case has one default thread (channel = CASE_CHAT). Calling this endpoint creates the thread if it doesn't exist yet (idempotent).",
    sendBody:
      "Send a user message and receive the AI reply synchronously. The backend forwards the message plus case context (phase, assessment, client data) to AI-engine.",
    autoDetectNote: {
      title: "Auto-detect intent",
      body:
        "When autoDetectIntent is true (default), the backend calls AI-engine's intent classifier before generating a response. This fills phaseCode and assessmentCode automatically based on message content.",
    },
    detectIntentBody:
      "Call this endpoint standalone to classify a message without sending it. Useful for building predictive UI (showing action buttons, routing to the right flow).",
    attachBody:
      "Upload documents (PDF, images) that AI-engine can reference during the conversation. The two-step flow: upload first, then send a message with attachmentIds.",
    visibilityBody:
      "Messages have a visibility field that controls who can see them:",
    visibilityItems: [
      "ALL — visible to both the end-user and internal staff (RM, WM, IM).",
      "INTERNAL — visible only to staff roles. Use for internal notes or AI-generated analysis not meant for the client.",
    ],
    errors: [
      {
        code: "CASE_NOT_FOUND",
        http: 404,
        reason: "caseId does not exist.",
        fix: "Create the case first via the Onboarding flow.",
      },
      {
        code: "THREAD_NOT_FOUND",
        http: 404,
        reason: "threadId does not match the case.",
        fix: "Call GET .../chat/thread to get the correct threadId.",
      },
      {
        code: "ATTACHMENT_TOO_LARGE",
        http: 413,
        reason: "File exceeds 10MB limit.",
        fix: "Compress or split the file before uploading.",
      },
      {
        code: "AI_TIMEOUT",
        http: 504,
        reason: "AI-engine took longer than 30s.",
        fix: "Retry after 5s; if it persists contact support.",
      },
      {
        code: "RATE_LIMITED",
        http: 429,
        reason: "More than 30 msg/min/case.",
        fix: "Throttle message sending on the client side.",
      },
    ] as ErrorRowI18n[],
    nextDiscovery: {
      title: "Submit discovery",
      desc: "Push assets and goals collected during chat to the discovery flow.",
    },
    nextWebhook: {
      title: "Webhooks",
      desc: "Listen for chat.message.ai_reply events in real-time.",
    },
  },
  vi: {
    eyebrow: "Guides · Chat",
    title: "Tích hợp chat channel",
    description:
      "Tích hợp kênh chat AI vào ứng dụng đối tác. Gửi tin nhắn thay user, nhận phản hồi AI kèm intent detection, và đính kèm tài liệu cho cuộc hội thoại context-aware.",
    sec: {
      when: "Khi nào dùng",
      diagram: "Sequence diagram",
      prereq: "Prerequisites",
      thread: "Lấy hoặc tạo thread",
      send: "Gửi tin nhắn",
      detectIntent: "Detect intent (pre-check tuỳ chọn)",
      attachments: "Đính kèm tài liệu",
      visibility: "Mô hình visibility",
      errors: "Lỗi thường gặp",
    },
    whenBody:
      "Khi ứng dụng đối tác nhúng trải nghiệm chat kết nối với SmartWealth AI-engine. Chat channel gắn với case và theo lifecycle của case — AI trả lời dựa trên context (phase, assessment, profile khách hàng).",
    prereqItems: [
      "API key có scope chat:write.",
      "caseId hợp lệ (tạo qua luồng Onboarding case).",
      "Sandbox hoặc production tuỳ giai đoạn tích hợp.",
    ],
    threadBody:
      "Mỗi case có một thread mặc định (channel = CASE_CHAT). Gọi endpoint này sẽ tạo thread nếu chưa có (idempotent).",
    sendBody:
      "Gửi tin nhắn user và nhận reply AI đồng bộ. Backend forward message kèm context case (phase, assessment, data khách hàng) tới AI-engine.",
    autoDetectNote: {
      title: "Tự động detect intent",
      body:
        "Khi autoDetectIntent = true (mặc định), backend gọi intent classifier của AI-engine trước khi sinh response. Tự động điền phaseCode và assessmentCode dựa trên nội dung tin nhắn.",
    },
    detectIntentBody:
      "Gọi endpoint này độc lập để phân loại tin nhắn mà không gửi đi. Hữu ích cho predictive UI (hiển thị action button, routing sang flow phù hợp).",
    attachBody:
      "Upload tài liệu (PDF, ảnh) mà AI-engine có thể tham chiếu trong cuộc hội thoại. Flow 2 bước: upload trước, sau đó gửi message kèm attachmentIds.",
    visibilityBody:
      "Message có trường visibility quyết định ai được xem:",
    visibilityItems: [
      "ALL — hiển thị cho cả end-user lẫn staff nội bộ (RM, WM, IM).",
      "INTERNAL — chỉ staff roles mới thấy. Dùng cho ghi chú nội bộ hoặc phân tích AI không dành cho khách hàng.",
    ],
    errors: [
      {
        code: "CASE_NOT_FOUND",
        http: 404,
        reason: "caseId không tồn tại.",
        fix: "Tạo case trước qua luồng Onboarding.",
      },
      {
        code: "THREAD_NOT_FOUND",
        http: 404,
        reason: "threadId không thuộc case này.",
        fix: "Gọi GET .../chat/thread để lấy đúng threadId.",
      },
      {
        code: "ATTACHMENT_TOO_LARGE",
        http: 413,
        reason: "File vượt quá 10MB.",
        fix: "Nén hoặc chia nhỏ file trước khi upload.",
      },
      {
        code: "AI_TIMEOUT",
        http: 504,
        reason: "AI-engine xử lý > 30s.",
        fix: "Retry sau 5s; nếu lặp lại liên hệ support.",
      },
      {
        code: "RATE_LIMITED",
        http: 429,
        reason: "> 30 msg/phút/case.",
        fix: "Throttle gửi tin nhắn phía client.",
      },
    ] as ErrorRowI18n[],
    nextDiscovery: {
      title: "Submit discovery",
      desc: "Đẩy assets/goals thu thập qua chat vào luồng discovery.",
    },
    nextWebhook: {
      title: "Webhooks",
      desc: "Lắng nghe event chat.message.ai_reply real-time.",
    },
  },
};

const conceptCaseWorkflow = {
  en: {
    eyebrow: "Concepts",
    title: "Case & workflow",
    description:
      "Understand the core entities: case, client, workflow, phase, assessment — and how they relate.",
    sec: {
      entities: "Core entities",
      lifecycle: "Lifecycle",
      workflow: "Workflow & state",
    },
    entityClient: "physical customer with profile, assets, goals.",
    entityCase: "an advisory engagement for a client; has phase and status.",
    entityWorkflow: "an internal state machine tied to a case; referenced via workflowId.",
    entityAssessment:
      "AI scoring unit attached to each phase. Example: onboarding_completeness in ONBOARDING.",
    lifecycleBody:
      "A case proceeds through the phases listed in phase_order (AI catalog). Each phase has 0..N assessments triggered automatically when sufficient data is present.",
    stateCaption: "Demo state machine",
    workflowNote:
      "Partners do not flip workflow states directly. State changes are driven by the server + AI-engine. Partners observe via case.status and webhook events.",
  },
  vi: {
    eyebrow: "Concepts",
    title: "Case & workflow",
    description:
      "Nắm các entity cơ bản: case, client, workflow, phase, assessment — và quan hệ giữa chúng.",
    sec: {
      entities: "Các entity chính",
      lifecycle: "Lifecycle",
      workflow: "Workflow & state",
    },
    entityClient: "khách hàng vật lý, có profile, assets, goals.",
    entityCase: "một \"đợt\" tư vấn của client, có phase và status.",
    entityWorkflow: "chuỗi state máy nội bộ gắn với case; được tham chiếu qua workflowId.",
    entityAssessment:
      "đơn vị đánh giá AI gắn vào từng phase. Ví dụ onboarding_completeness ở ONBOARDING.",
    lifecycleBody:
      "Case đi qua các phase theo thứ tự phase_order trong AI catalog. Mỗi phase có thể có 0..N assessment chạy tự động khi đủ dữ liệu.",
    stateCaption: "State machine demo",
    workflowNote:
      "Đối tác không thao tác trực tiếp với workflow state. State đổi do server nội bộ + AI-engine. Đối tác nhận biết qua case.status và webhook events.",
  },
};

const conceptCatalogSsot = {
  en: {
    eyebrow: "Concepts",
    title: "Catalog SSOT",
    description:
      "case_phase → catalog assessments mapping plus all system_prompt / loop_input live in Postgres as SSOT. The repo only carries snapshots for tests.",
    sec: {
      what: "Why SSOT in Postgres",
      tables: "Related tables",
      version: "Versioning",
    },
    whatBody:
      "Updating prompt/loop_input does not require redeploying AI-engine — admins update via DB or the admin API /api/admin/ai-engine/.... Partners only see the read-only side via /api/integration/v1/ai-catalog/....",
    tables: [
      "case_phase — code, displayName, sortOrder, enabled, catalogVersion.",
      "ai_interaction — interactionId (catalog assessments), phaseCode, loopInput, systemPrompt.",
      "ai_llm_profile — provider config (DeepSeek / Azure OpenAI), encrypted API key, feature flags.",
    ],
    versionBody:
      "Each snapshot has catalogVersion. When partners cache locally, use the version to invalidate. The catalog.updated webhook will be emitted when admin commits changes (planned).",
    note: {
      title: "No client-side prompt rendering",
      body:
        "Prompts and loop_inputs run server-side inside AI-engine. Partners never render prompts themselves — only know the assessment code being run.",
    },
  },
  vi: {
    eyebrow: "Concepts",
    title: "Catalog SSOT",
    description:
      "Mapping case_phase → catalog assessments và toàn bộ system_prompt / loop_input là SSOT trong Postgres. Repo chỉ giữ snapshot cho test.",
    sec: {
      what: "Tại sao SSOT trong Postgres",
      tables: "Bảng liên quan",
      version: "Versioning",
    },
    whatBody:
      "Khi đổi prompt/loop_input không cần redeploy AI-engine — admin sửa trong DB hoặc qua admin API /api/admin/ai-engine/.... Đối tác chỉ thấy phần read-only qua /api/integration/v1/ai-catalog/....",
    tables: [
      "case_phase — code, displayName, sortOrder, enabled, catalogVersion.",
      "ai_interaction — interactionId (catalog assessments), phaseCode, loopInput, systemPrompt.",
      "ai_llm_profile — config provider (DeepSeek / Azure OpenAI), API key (encrypted), feature flags.",
    ],
    versionBody:
      "Mỗi snapshot có catalogVersion. Khi đối tác cache local, dùng version để invalidate. Webhook catalog.updated sẽ được phát khi admin commit thay đổi (planned).",
    note: {
      title: "Không chuyển đổi prompt phía client",
      body:
        "Mọi prompt và loop_input chạy server-side trong AI-engine. Đối tác không bao giờ phải tự render prompt — chỉ cần biết assessment code đang chạy.",
    },
  },
};

const conceptIdempotency = {
  en: {
    eyebrow: "Concepts",
    title: "Idempotency & retry",
    description:
      "How to call safely under network failures: use Idempotency-Key for POST, exponential backoff for retries, dedupe webhooks by event id.",
    sec: {
      key: "Idempotency-Key",
      retry: "Retry policy",
      webhook: "Webhook dedupe",
    },
    keyBody:
      "Any POST that creates a resource (cases, plans, recommendations, instructions) accepts an Idempotency-Key: <uuid> header. The same key within 24h returns the original response, no duplicate side-effects.",
    retryItems: [
      "Only retry on 408, 429, 5xx.",
      "Backoff: 250ms, 500ms, 1s, 2s, 4s — max 5 attempts.",
      "Reuse the same Idempotency-Key to avoid duplicates.",
    ],
    webhookBody:
      "Webhook delivery is at-least-once. Persist event.id and skip duplicates (recommended TTL: 7 days).",
    note: {
      title: "Don’t use a business id as Idempotency-Key",
      body:
        "Use a per-request UUID. Don’t reuse caseId or recId — they may apply to different operations later.",
    },
  },
  vi: {
    eyebrow: "Concepts",
    title: "Idempotency & retry",
    description:
      "Cách gọi an toàn khi network lỗi: dùng Idempotency-Key cho POST, exponential backoff cho retry, dedupe webhook bằng event id.",
    sec: {
      key: "Idempotency-Key",
      retry: "Retry policy",
      webhook: "Webhook dedupe",
    },
    keyBody:
      "Mọi request POST tạo resource (cases, plans, recommendations, instructions) có thể đính header Idempotency-Key: <uuid>. Cùng key trong 24h sẽ trả lại response gốc, không tạo trùng.",
    retryItems: [
      "Chỉ retry với HTTP 408, 429, 5xx.",
      "Backoff: 250ms, 500ms, 1s, 2s, 4s — max 5 lần.",
      "Đính cùng Idempotency-Key để tránh duplicate.",
    ],
    webhookBody:
      "Webhook delivery là at-least-once. Đối tác cần lưu lại event.id đã xử lý và bỏ qua nếu trùng (recommend: TTL 7 ngày).",
    note: {
      title: "Đừng dùng business id làm idempotency key",
      body:
        "Dùng UUID per-request, không dùng caseId hoặc recId — chúng có thể được dùng lại cho thao tác khác.",
    },
  },
};

const apiReference = {
  en: {
    eyebrow: "Reference",
    title: "API Reference",
    description:
      "OpenAPI 3.1 spec for the /api/integration/v1 surface. The sidebar groups endpoints by tag (Cases, Discovery, Plans, Recommendations, Execution, AI Catalog, Webhooks). Try-it works with sandbox tokens.",
    note: {
      title: "Tip",
      body: "This is a sample spec for the Developer portal. The source file lives at /public/openapi/integration.yaml. In production, CI can auto-export it from Springdoc by tag integration.",
    },
    loading: "Loading OpenAPI viewer…",
    failed: "Could not load spec",
  },
  vi: {
    eyebrow: "Reference",
    title: "API Reference",
    description:
      "OpenAPI 3.1 spec cho mặt phẳng /api/integration/v1. Sidebar liệt kê endpoint theo tag (Cases, Discovery, Plans, Recommendations, Execution, AI Catalog, Webhooks). Có Try-it với token sandbox.",
    note: {
      title: "Gợi ý",
      body: "Đây là spec mẫu cho Developer portal — file gốc nằm ở /public/openapi/integration.yaml. Trên thực tế CI có thể auto-export từ Springdoc theo tag integration.",
    },
    loading: "Đang nạp OpenAPI viewer…",
    failed: "Không load được spec",
  },
};

const webhooks = {
  en: {
    eyebrow: "Reference",
    title: "Webhooks",
    description:
      "SmartWealth pushes webhooks on state changes. At-least-once delivery, HMAC-SHA256 signature, exponential retry within 24h.",
    sec: {
      events: "Events",
      delivery: "Delivery",
      signature: "Signature verification",
      retry: "Retry policy",
    },
    rejectReplayTitle: "Reject if timestamp drift > 5 minutes",
    rejectReplayBody:
      "Compare t against current server time to mitigate replay attacks.",
    eventsTable: {
      headerType: "Type",
      headerWhen: "Emitted when",
      headerPayload: "Payload",
      rows: [
        {
          type: "case.discovery.ready",
          when: "After onboarding_completeness finishes — status READY or MISSING_DATA.",
          payload: "{ caseId, clientId, status, missingFields[] }",
        },
        {
          type: "recommendation.created",
          when: "When AI or RM creates a new recommendation.",
          payload: "{ recommendationId, planVersionId, recType, summary }",
        },
        {
          type: "execution.sent",
          when: "When an instruction is forwarded downstream.",
          payload: "{ instructionId, recommendationId, status }",
        },
        {
          type: "chat.message.ai_reply",
          when: "When AI-engine completes a chat reply (async notification).",
          payload: "{ caseId, threadId, messageId, intentCode }",
        },
        {
          type: "case.status.changed",
          when: "Whenever the case phase/status changes (catch-all).",
          payload: "{ caseId, fromStatus, toStatus, occurredAt }",
        },
      ],
    },
    retryCaption: "1m → 5m → 30m → 2h → 12h, stop after 24h",
    retryRows: [
      { code: "200", http: 200, reason: "Partner returned 2xx → marked successful.", fix: "Nothing to do." },
      { code: "4xx", http: 400, reason: "Client error → SmartWealth stops retrying.", fix: "Fix the endpoint, replay from dashboard." },
      { code: "5xx/timeout", http: 500, reason: "Server error → retried per schedule.", fix: "Make sure the endpoint replies within 10s." },
    ] as ErrorRowI18n[],
  },
  vi: {
    eyebrow: "Reference",
    title: "Webhooks",
    description:
      "SmartWealth gửi webhook khi state đổi. At-least-once delivery, có chữ ký HMAC-SHA256, retry exponential trong 24h.",
    sec: {
      events: "Events",
      delivery: "Delivery",
      signature: "Signature verification",
      retry: "Retry policy",
    },
    rejectReplayTitle: "Reject nếu timestamp lệch > 5 phút",
    rejectReplayBody:
      "So sánh t với thời gian server hiện tại để chống replay attack.",
    eventsTable: {
      headerType: "Type",
      headerWhen: "Khi nào phát",
      headerPayload: "Payload",
      rows: [
        {
          type: "case.discovery.ready",
          when: "Sau khi onboarding_completeness chấm xong, status = READY hoặc MISSING_DATA.",
          payload: "{ caseId, clientId, status, missingFields[] }",
        },
        {
          type: "recommendation.created",
          when: "Khi AI hoặc RM tạo recommendation mới.",
          payload: "{ recommendationId, planVersionId, recType, summary }",
        },
        {
          type: "execution.sent",
          when: "Khi instruction được forward sang downstream.",
          payload: "{ instructionId, recommendationId, status }",
        },
        {
          type: "chat.message.ai_reply",
          when: "Khi AI-engine hoàn thành reply chat (thông báo async).",
          payload: "{ caseId, threadId, messageId, intentCode }",
        },
        {
          type: "case.status.changed",
          when: "Khi case đổi phase/status (catch-all).",
          payload: "{ caseId, fromStatus, toStatus, occurredAt }",
        },
      ],
    },
    retryCaption: "1m → 5m → 30m → 2h → 12h, dừng sau 24h",
    retryRows: [
      { code: "200", http: 200, reason: "Đối tác trả 2xx → đánh dấu thành công.", fix: "Không cần làm gì." },
      { code: "4xx", http: 400, reason: "Client error → SmartWealth dừng retry.", fix: "Sửa endpoint, request lại từ dashboard." },
      { code: "5xx/timeout", http: 500, reason: "Server error → retry theo lịch.", fix: "Đảm bảo endpoint xử lý < 10s." },
    ] as ErrorRowI18n[],
  },
};

const errorsPage = {
  en: {
    eyebrow: "Reference",
    title: "Errors",
    description:
      "All error responses follow the same { code, message, details? } shape. Standard codes are listed below.",
    sec: {
      shape: "Error shape",
      common: "Common codes",
      rate: "Rate limit",
    },
    rows: [
      { code: "VALIDATION_FAILED", http: 400, reason: "Body fails schema.", fix: "Fix payload according to OpenAPI." },
      { code: "MISSING_REQUIRED_FIELD", http: 400, reason: "Required field missing.", fix: "Check the schema." },
      { code: "UNAUTHORIZED", http: 401, reason: "Missing or wrong API key.", fix: "Check Authorization header." },
      { code: "FORBIDDEN", http: 403, reason: "Key lacks the required scope.", fix: "Grant proper scopes in dashboard." },
      { code: "NOT_FOUND", http: 404, reason: "Resource doesn’t exist.", fix: "Verify the ID." },
      { code: "DECISION_ALREADY_APPLIED", http: 409, reason: "State conflict.", fix: "Refresh and re-read state." },
      { code: "RATE_LIMITED", http: 429, reason: "Above quota/min.", fix: "Backoff per Retry-After." },
      { code: "AI_TIMEOUT", http: 504, reason: "AI-engine too slow.", fix: "Retry after 5s; >3 contact support." },
      { code: "DOWNSTREAM_REJECTED", http: 502, reason: "Core banking refused.", fix: "Inspect details.reason." },
      { code: "ASSESSMENT_DISABLED", http: 503, reason: "Feature flag OFF.", fix: "Contact admin." },
    ] as ErrorRowI18n[],
    rateItems: [
      "Sandbox: 60 req/min/key.",
      "Production: 600 req/min/key, can be raised on request.",
      "Returned headers: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After.",
    ],
  },
  vi: {
    eyebrow: "Reference",
    title: "Errors",
    description:
      "Mọi response lỗi tuân theo cùng schema { code, message, details? }. Các code chuẩn được liệt kê ở dưới.",
    sec: {
      shape: "Error shape",
      common: "Common codes",
      rate: "Rate limit",
    },
    rows: [
      { code: "VALIDATION_FAILED", http: 400, reason: "Body sai schema.", fix: "Sửa payload theo OpenAPI." },
      { code: "MISSING_REQUIRED_FIELD", http: 400, reason: "Thiếu field required.", fix: "Đối chiếu schema." },
      { code: "UNAUTHORIZED", http: 401, reason: "Thiếu/sai API key.", fix: "Kiểm tra header Authorization." },
      { code: "FORBIDDEN", http: 403, reason: "Key thiếu scope.", fix: "Cấp scope đủ trong dashboard." },
      { code: "NOT_FOUND", http: 404, reason: "Resource không tồn tại.", fix: "Verify ID." },
      { code: "DECISION_ALREADY_APPLIED", http: 409, reason: "Conflict do state.", fix: "Refresh và đọc state." },
      { code: "RATE_LIMITED", http: 429, reason: "> quota/phút.", fix: "Backoff theo Retry-After." },
      { code: "AI_TIMEOUT", http: 504, reason: "AI-engine quá chậm.", fix: "Retry sau 5s; >3 lần liên hệ support." },
      { code: "DOWNSTREAM_REJECTED", http: 502, reason: "Core banking từ chối.", fix: "Đọc details.reason." },
      { code: "ASSESSMENT_DISABLED", http: 503, reason: "Feature flag OFF.", fix: "Liên hệ admin." },
    ] as ErrorRowI18n[],
    rateItems: [
      "Sandbox: 60 req/phút/key.",
      "Production: 600 req/phút/key, có thể yêu cầu nâng cấp.",
      "Header trả về: X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After.",
    ],
  },
};

const changelog = {
  en: {
    eyebrow: "Reference",
    title: "Changelog",
    description:
      "Every change to the public contract is logged here. Semver — major bump = breaking change.",
    versionTitle: "v0.2.0 — 2026-05-14",
    versionItems: [
      "Chat channel integration: thread, messages, detect-intent, attachments.",
      "New webhook event: chat.message.ai_reply.",
      "Guide: Chat channel integration added to docs.",
    ],
    version010Title: "v0.1.0 — 2026-05-10",
    version010Items: [
      "Initial public preview.",
      "Endpoints: cases, discovery, plans, recommendations, execution, ai-catalog.",
      "Webhooks: case.discovery.ready, recommendation.created, execution.sent, case.status.changed.",
      "Sandbox: rate limit 60 req/min/key.",
    ],
    policyTitle: "Deprecation policy",
    policyItems: [
      "Before removal: a Deprecation: true and Sunset: <date> header is emitted for at least 90 days.",
      "Email is sent to the partner contact in the dashboard.",
      "Old version runs in parallel for 90 days.",
    ],
  },
  vi: {
    eyebrow: "Reference",
    title: "Changelog",
    description:
      "Mỗi thay đổi public contract đều có ghi chú ở đây. Theo Semver — major bump = breaking change.",
    versionTitle: "v0.2.0 — 2026-05-14",
    versionItems: [
      "Tích hợp chat channel: thread, messages, detect-intent, attachments.",
      "Webhook event mới: chat.message.ai_reply.",
      "Guide: thêm tài liệu tích hợp chat channel.",
    ],
    version010Title: "v0.1.0 — 2026-05-10",
    version010Items: [
      "Initial public preview.",
      "Endpoints: cases, discovery, plans, recommendations, execution, ai-catalog.",
      "Webhooks: case.discovery.ready, recommendation.created, execution.sent, case.status.changed.",
      "Sandbox: rate limit 60 req/phút/key.",
    ],
    policyTitle: "Deprecation policy",
    policyItems: [
      "Trước khi remove: thêm header Deprecation: true + Sunset: <date> tối thiểu 90 ngày.",
      "Email cho contact của partner trong dashboard.",
      "Bản cũ giữ chạy song song trong 90 ngày.",
    ],
  },
};

export const dict = {
  en: {
    common: common.en,
    errors: errors.en,
    nav: nav.en,
    pages: {
      overview: overview.en,
      authentication: authentication.en,
      quickstart: quickstart.en,
      apiReference: apiReference.en,
      webhooks: webhooks.en,
      errorsPage: errorsPage.en,
      changelog: changelog.en,
      guideOnboarding: guideOnboarding.en,
      guideDiscovery: guideDiscovery.en,
      guideDiscoveryCheck: guideDiscoveryCheck.en,
      guidePlanRec: guidePlanRec.en,
      guideDecisionExec: guideDecisionExec.en,
      guideAiCatalog: guideAiCatalog.en,
      guideChatChannel: guideChatChannel.en,
      conceptCaseWorkflow: conceptCaseWorkflow.en,
      conceptCatalogSsot: conceptCatalogSsot.en,
      conceptIdempotency: conceptIdempotency.en,
    },
  },
  vi: {
    common: common.vi,
    errors: errors.vi,
    nav: nav.vi,
    pages: {
      overview: overview.vi,
      authentication: authentication.vi,
      quickstart: quickstart.vi,
      apiReference: apiReference.vi,
      webhooks: webhooks.vi,
      errorsPage: errorsPage.vi,
      changelog: changelog.vi,
      guideOnboarding: guideOnboarding.vi,
      guideDiscovery: guideDiscovery.vi,
      guideDiscoveryCheck: guideDiscoveryCheck.vi,
      guidePlanRec: guidePlanRec.vi,
      guideDecisionExec: guideDecisionExec.vi,
      guideAiCatalog: guideAiCatalog.vi,
      guideChatChannel: guideChatChannel.vi,
      conceptCaseWorkflow: conceptCaseWorkflow.vi,
      conceptCatalogSsot: conceptCatalogSsot.vi,
      conceptIdempotency: conceptIdempotency.vi,
    },
  },
} as const;

export type Lang = keyof typeof dict;
export type Dict = (typeof dict)[Lang];
