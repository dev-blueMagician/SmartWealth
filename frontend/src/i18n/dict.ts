// Source-of-truth dictionary for EN + VI (internal Professional Portal).
// Both locales must keep an identical shape — TypeScript will flag any mismatch.
// Pattern mirrors frontend-openapi/src/i18n for consistency across the codebase.

export type Lang = 'en' | 'vi';

export type Dict = {
  nav: {
    dashboard: string;
    cases: string;
    planTemplates: string;
    investments: string;
    compliance: string;
    users: string;
    settings: string;
    discoverySetup: string;
    questions: string;
    fieldDictionary: string;
    fieldMappings: string;
    aiEngine: string;
    workflowAi: string;
    aiSettings: string;
    casePhases: string;
    aiInteractions: string;
    signOut: string;
  };
  header: {
    portalTitle: string;
    welcome: (name: string) => string;
    searchClients: string;
    switchToClient: string;
  };
  dashboard: {
    quickActions: string;
    quickActionsHint: string;
    activeCases: string;
    pendingDiscovery: string;
    planningReady: string;
    dataSource: string;
    loadingLabel: string;
    activeServiceCases: string;
    createCase: string;
    loadingCases: string;
    noCases: string;
    qaCreateCase: string;
    qaCreateCaseDesc: string;
    qaPlanning: string;
    qaPlanningDesc: string;
    qaInvestments: string;
    qaInvestmentsDesc: string;
    qaExecution: string;
    qaExecutionDesc: string;
    qaDiscovery: string;
    qaDiscoveryDesc: string;
    qaAiEngine: string;
    qaAiEngineDesc: string;
    qaUsers: string;
    qaUsersDesc: string;
  };
  lang: {
    label: string;
  };
};

export const dict: Record<Lang, Dict> = {
  en: {
    nav: {
      dashboard: 'Dashboard',
      cases: 'Cases',
      planTemplates: 'Plan templates',
      investments: 'Investments',
      compliance: 'Compliance',
      users: 'Users',
      settings: 'Settings',
      discoverySetup: 'Discovery setup',
      questions: 'Questions',
      fieldDictionary: 'Field dictionary',
      fieldMappings: 'Field mappings',
      aiEngine: 'AI-engine',
      workflowAi: 'Workflow AI',
      aiSettings: 'AI settings',
      casePhases: 'Case phases',
      aiInteractions: 'AI interactions',
      signOut: 'Sign out',
    },
    header: {
      portalTitle: 'Professional Portal',
      welcome: (name) => `Welcome back, ${name}. Here's what needs your attention.`,
      searchClients: 'Search clients...',
      switchToClient: 'Switch to Client View',
    },
    dashboard: {
      quickActions: 'Quick actions',
      quickActionsHint: 'Shown based on your role',
      activeCases: 'Active Cases',
      pendingDiscovery: 'Pending Discovery',
      planningReady: 'Planning Ready',
      dataSource: 'Data Source',
      loadingLabel: 'Loading',
      activeServiceCases: 'Active Service Cases',
      createCase: 'Create Case',
      loadingCases: 'Loading cases...',
      noCases: 'No cases found from backend.',
      qaCreateCase: 'Create case',
      qaCreateCaseDesc: 'Start onboarding for a new client',
      qaPlanning: 'Planning',
      qaPlanningDesc: 'Open the financial planning workspace',
      qaInvestments: 'Investments',
      qaInvestmentsDesc: 'Review strategy and allocation',
      qaExecution: 'Execution',
      qaExecutionDesc: 'Create execution instructions',
      qaDiscovery: 'Discovery setup',
      qaDiscoveryDesc: 'Manage questions and field mappings',
      qaAiEngine: 'AI-engine',
      qaAiEngineDesc: 'Configure AI catalog and LLM profiles',
      qaUsers: 'Users',
      qaUsersDesc: 'Manage portal users and roles',
    },
    lang: {
      label: 'Language',
    },
  },
  vi: {
    nav: {
      dashboard: 'Bảng điều khiển',
      cases: 'Hồ sơ',
      planTemplates: 'Mẫu kế hoạch',
      investments: 'Đầu tư',
      compliance: 'Tuân thủ',
      users: 'Người dùng',
      settings: 'Cài đặt',
      discoverySetup: 'Thiết lập Discovery',
      questions: 'Câu hỏi',
      fieldDictionary: 'Từ điển trường',
      fieldMappings: 'Ánh xạ trường',
      aiEngine: 'AI-engine',
      workflowAi: 'Quy trình AI',
      aiSettings: 'Cài đặt AI',
      casePhases: 'Giai đoạn hồ sơ',
      aiInteractions: 'Tương tác AI',
      signOut: 'Đăng xuất',
    },
    header: {
      portalTitle: 'Cổng nghiệp vụ',
      welcome: (name) => `Chào mừng trở lại, ${name}. Đây là những việc cần bạn xử lý.`,
      searchClients: 'Tìm khách hàng...',
      switchToClient: 'Chuyển sang giao diện khách hàng',
    },
    dashboard: {
      quickActions: 'Tác vụ nhanh',
      quickActionsHint: 'Hiển thị theo vai trò của bạn',
      activeCases: 'Hồ sơ đang xử lý',
      pendingDiscovery: 'Chờ Discovery',
      planningReady: 'Sẵn sàng lập kế hoạch',
      dataSource: 'Nguồn dữ liệu',
      loadingLabel: 'Đang tải',
      activeServiceCases: 'Hồ sơ dịch vụ đang hoạt động',
      createCase: 'Tạo hồ sơ',
      loadingCases: 'Đang tải hồ sơ...',
      noCases: 'Không tìm thấy hồ sơ từ backend.',
      qaCreateCase: 'Tạo hồ sơ',
      qaCreateCaseDesc: 'Khởi tạo onboarding cho khách hàng mới',
      qaPlanning: 'Lập kế hoạch',
      qaPlanningDesc: 'Mở workspace lập kế hoạch tài chính',
      qaInvestments: 'Đầu tư',
      qaInvestmentsDesc: 'Xem chiến lược và phân bổ danh mục',
      qaExecution: 'Thực thi',
      qaExecutionDesc: 'Tạo chỉ thị thực thi',
      qaDiscovery: 'Thiết lập Discovery',
      qaDiscoveryDesc: 'Quản lý câu hỏi và ánh xạ trường',
      qaAiEngine: 'AI-engine',
      qaAiEngineDesc: 'Cấu hình catalog AI và hồ sơ LLM',
      qaUsers: 'Người dùng',
      qaUsersDesc: 'Quản lý người dùng và vai trò cổng',
    },
    lang: {
      label: 'Ngôn ngữ',
    },
  },
};
