/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useLocation,
  useNavigate,
  Navigate,
  useParams,
} from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { RequireInternalAuth } from './auth/RequireInternalAuth';
import { RequireCapability } from './auth/RequireCapability';
import type { PortalCapabilities } from './auth/portalPermissions';
import { LoginPage } from './pages/Login';
import { motion, AnimatePresence } from 'motion/react';
import { useEffect, useState } from 'react';
import { 
  Users, 
  LayoutDashboard, 
  Briefcase, 
  Settings, 
  Bell, 
  Search, 
  Plus, 
  Home, 
  PieChart, 
  MessageSquare, 
  User as UserIcon, 
  LogOut,
  ChevronRight,
  TrendingUp,
  FileText,
  ShieldCheck,
  Smartphone,
  Zap,
  Cpu,
  ChevronDown,
  ClipboardList,
} from 'lucide-react';
import { cn } from './lib/utils';
import { CaseListPage } from './pages/internal/CaseList';
import { CaseDetailPage } from './pages/internal/CaseDetail';
import { CaseCreationPage } from './pages/internal/CaseCreation';
import { PlanningWorkspacePage } from './pages/internal/PlanningWorkspace';
import { ExecutionConsolePage } from './pages/internal/ExecutionConsole';
import { CopilotChat } from './pages/internal/CopilotChat';
import { WorkflowListPage } from './pages/internal/WorkflowList';
import { WorkflowDetailPage } from './pages/internal/WorkflowDetail';
import { UserManagementPage } from './pages/internal/UserManagement';
import { AiEngineCasePhasesPage } from './pages/internal/ai-engine/AiEngineCasePhasesPage';
import { AiEngineInteractionsPage } from './pages/internal/ai-engine/AiEngineInteractionsPage';
import { AiEngineLlmProfilesPage } from './pages/internal/ai-engine/AiEngineLlmProfilesPage';
import { DiscoveryQuestionnairePage } from './pages/internal/discovery/DiscoveryQuestionnairePage';
import { DiscoveryMappingPage } from './pages/internal/discovery/DiscoveryMappingPage';
import { DiscoveryQuestionsPage } from './pages/internal/discovery/DiscoveryQuestionsPage';
import { DiscoveryDictionaryPage } from './pages/internal/discovery/DiscoveryDictionaryPage';
import { PlanningTemplateRegistryPage } from './pages/internal/planning/PlanningTemplateRegistryPage';
import { MobileOnboardingPage } from './pages/mobile/Onboarding';
import { MobileWealthGoalsAssetsPage } from './pages/mobile/WealthGoalsAssets';
import { RiskQuestionnaire } from './components/RiskQuestionnaire';
import { InvestmentCockpit } from './components/InvestmentCockpit';
import { AdvicePreview } from './components/AdvicePreview';
import { wealthApi, type WorkflowCreateClientOption } from './services/wealthApi';
import { getAccessToken } from './auth/session';
import { getMobileClientId, setMobileClientId } from './lib/mobileClientSession';
import { toApiError, type ApiError } from './services/apiError';
import { ErrorPopup } from './components/ErrorPopup';
import { SuccessToast } from './components/SuccessToast';

async function fetchMobileClientOptions(): Promise<WorkflowCreateClientOption[]> {
  return wealthApi.listResolvedClients();
}

// --- Components ---

type MenuDef = {
  icon: typeof LayoutDashboard;
  label: string;
  path: string;
  /** Hide menu item when this capability is false (aligned with backend SecurityConfig). */
  requires?: keyof PortalCapabilities;
};

type NavGroupChild = {
  label: string;
  path: string;
  requires: keyof PortalCapabilities;
};

const AI_ENGINE_CHILDREN: NavGroupChild[] = [
  { label: 'Workflow AI', path: '/internal/ai-engine/workflows', requires: 'canUseStaffDataApis' },
  { label: 'AI settings', path: '/internal/ai-engine/settings', requires: 'canManageAiEngineCatalog' },
  { label: 'Case phases', path: '/internal/ai-engine/case-phases', requires: 'canManageAiEngineCatalog' },
  { label: 'AI interactions', path: '/internal/ai-engine/ai-interactions', requires: 'canManageAiEngineCatalog' },
];

/** Business discovery setup (questionnaire catalog, field dictionary, Q→field mappings). */
const DISCOVERY_SETUP_CHILDREN: NavGroupChild[] = [
  { label: 'Questions', path: '/internal/discovery/questions', requires: 'canManageDiscoveryMappings' },
  { label: 'Field dictionary', path: '/internal/discovery/dictionary', requires: 'canManageDiscoveryMappings' },
  { label: 'Field mappings', path: '/internal/discovery/mappings', requires: 'canManageDiscoveryMappings' },
];

function RedirectLegacyWorkflowList() {
  return <Navigate to="/internal/ai-engine/workflows" replace />;
}

function RedirectLegacyWorkflowDetail() {
  const { workflowId } = useParams<{ workflowId: string }>();
  return <Navigate to={`/internal/ai-engine/workflows/${workflowId ?? ''}`} replace />;
}

const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { auth, logout, portalCaps } = useAuth();

  const [aiGroupOpen, setAiGroupOpen] = useState(
    () =>
      location.pathname.startsWith('/internal/ai-engine')
      || location.pathname.startsWith('/internal/workflows'),
  );
  const [discoveryGroupOpen, setDiscoveryGroupOpen] = useState(() =>
    location.pathname.startsWith('/internal/discovery'),
  );

  useEffect(() => {
    if (
      location.pathname.startsWith('/internal/ai-engine')
      || location.pathname.startsWith('/internal/workflows')
    ) {
      setAiGroupOpen(true);
    }
    if (location.pathname.startsWith('/internal/discovery')) {
      setDiscoveryGroupOpen(true);
    }
  }, [location.pathname]);

  const allItems: MenuDef[] = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/internal', requires: 'canUseStaffDataApis' },
        { icon: Briefcase, label: 'Cases', path: '/internal/cases', requires: 'canUseStaffDataApis' },
        { icon: FileText, label: 'Plan templates', path: '/internal/planning/templates', requires: 'canManageAiEngineCatalog' },
        { icon: TrendingUp, label: 'Investments', path: '/internal/investments', requires: 'canViewInvestments' },
        { icon: ShieldCheck, label: 'Compliance', path: '/internal/compliance', requires: 'canUseStaffDataApis' },
        { icon: Users, label: 'Users', path: '/internal/users', requires: 'canManagePortalUsers' },
        { icon: Settings, label: 'Settings', path: '/internal/settings', requires: 'canUseStaffDataApis' },
  ];

  const menuItems = allItems.filter((item) => !item.requires || portalCaps[item.requires]);

  const visibleAiChildren = AI_ENGINE_CHILDREN.filter((c) => portalCaps[c.requires]);
  const showAiEngineGroup = visibleAiChildren.length > 0;
  const aiSectionActive =
    location.pathname.startsWith('/internal/ai-engine')
    || location.pathname.startsWith('/internal/workflows');

  const visibleDiscoveryChildren = DISCOVERY_SETUP_CHILDREN.filter((c) => portalCaps[c.requires]);
  const showDiscoverySetupGroup = visibleDiscoveryChildren.length > 0;
  const discoverySetupActive = location.pathname.startsWith('/internal/discovery');

  const initials = auth?.username
    ? auth.username.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase() ||
      auth.username.slice(0, 2).toUpperCase()
    : '—';

  const roleLabel = auth?.roles?.length ? auth.roles.join(' · ') : 'Staff';

  return (
    <div className="w-64 bg-slate-900 text-slate-300 h-screen flex flex-col border-r border-slate-800">
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center text-white font-bold">N</div>
        <span className="text-xl font-semibold text-white tracking-tight">Nexus WM</span>
      </div>
      <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group",
                active ? "bg-indigo-500/10 text-indigo-400 font-medium" : "hover:bg-slate-800/50 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", active ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
              {item.label}
              {active && <motion.div layoutId="activeNav" className="ml-auto w-1 h-4 bg-indigo-400 rounded-full" />}
            </Link>
          );
        })}

        {showDiscoverySetupGroup ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setDiscoveryGroupOpen((o) => !o)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left',
                discoverySetupActive
                  ? 'bg-indigo-500/10 text-indigo-400 font-medium'
                  : 'hover:bg-slate-800/50 hover:text-white text-slate-300',
              )}
            >
              <ClipboardList
                className={cn('w-5 h-5', discoverySetupActive ? 'text-indigo-400' : 'text-slate-500')}
              />
              <span className="flex-1">Discovery setup</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', discoveryGroupOpen && 'rotate-180')} />
            </button>
            {discoveryGroupOpen ? (
              <div className="ml-2 mt-1 pl-3 border-l border-slate-700 space-y-0.5">
                {visibleDiscoveryChildren.map((child) => {
                  const childActive = location.pathname === child.path;
                  return (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                        childActive
                          ? 'text-indigo-400 font-medium bg-slate-800/60'
                          : 'text-slate-400 hover:text-white hover:bg-slate-800/40',
                      )}
                    >
                      <FileText className="w-4 h-4 shrink-0 opacity-80" />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}

        {showAiEngineGroup ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setAiGroupOpen((o) => !o)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-left',
                aiSectionActive ? 'bg-indigo-500/10 text-indigo-400 font-medium' : 'hover:bg-slate-800/50 hover:text-white text-slate-300',
              )}
            >
              <Cpu className={cn('w-5 h-5', aiSectionActive ? 'text-indigo-400' : 'text-slate-500')} />
              <span className="flex-1">AI-engine</span>
              <ChevronDown className={cn('w-4 h-4 transition-transform', aiGroupOpen && 'rotate-180')} />
            </button>
            {aiGroupOpen ? (
              <div className="ml-2 mt-1 pl-3 border-l border-slate-700 space-y-0.5">
                {visibleAiChildren.map((child) => {
                  const childActive =
                    location.pathname === child.path ||
                    (child.path.endsWith('/workflows') &&
                      location.pathname.startsWith('/internal/ai-engine/workflows'));
                  return (
                    <Link
                      key={child.path}
                      to={child.path}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors',
                        childActive ? 'text-indigo-400 font-medium bg-slate-800/60' : 'text-slate-400 hover:text-white hover:bg-slate-800/40',
                      )}
                    >
                      {child.label === 'Workflow AI' ? (
                        <Zap className="w-4 h-4 shrink-0 opacity-80" />
                      ) : (
                        <Settings className="w-4 h-4 shrink-0 opacity-80" />
                      )}
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </nav>
      <div className="p-6 border-t border-slate-800">
        <div className="flex items-center gap-3 bg-slate-800/50 p-3 rounded-2xl">
          <div className="w-10 h-10 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-400 font-medium text-xs">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{auth?.username ?? '—'}</p>
            <p className="text-xs text-slate-500 truncate">{roleLabel}</p>
          </div>
          <button
            type="button"
            title="Sign out"
            onClick={() => {
              logout();
              navigate('/login', { replace: true });
            }}
            className="p-1 rounded-lg text-slate-500 hover:text-white hover:bg-slate-700/80 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const InternalLayout = ({ children }: { children: React.ReactNode }) => {
  const { auth } = useAuth();
  const displayName = auth?.username ?? 'there';
  return (
  <div className="flex h-screen bg-slate-50 font-sans">
    <Sidebar />
    <main className="flex-1 overflow-y-auto overflow-x-hidden p-8">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Professional Portal</h1>
          <p className="text-sm text-slate-500">Welcome back, {displayName}. Here&apos;s what needs your attention.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            <input 
              type="text" 
              placeholder="Search clients..." 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-64 transition-all"
            />
          </div>
          <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-all relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
          </button>
          <Link to="/mobile" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-all flex items-center gap-2">
            Switch to Client View <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </header>
      <AnimatePresence mode="wait">
        <motion.div
           key="internal-content"
           initial={{ opacity: 0, y: 10 }}
           animate={{ opacity: 1, y: 0 }}
           exit={{ opacity: 0, y: -10 }}
           transition={{ duration: 0.2 }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </main>
  </div>
  );
};

const MobileLayout = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 sm:p-0">
    {/* Device Frame Simulation */}
    <div className="w-full max-w-[420px] h-[850px] bg-white rounded-[3rem] shadow-2xl border-[8px] border-slate-900 overflow-hidden relative flex flex-col">
      <div className="h-44 bg-indigo-600 p-6 pt-12 text-white shrink-0 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Hello, David</h2>
            <p className="text-white/80 text-sm">Your wealth snapshot</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center backdrop-blur-md">
             <UserIcon className="w-5 h-5" />
          </div>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto p-5 -mt-6 bg-white rounded-t-3xl relative z-20">
        <AnimatePresence mode="wait">
          {children}
        </AnimatePresence>
      </div>

      <nav className="h-20 border-t border-slate-100 flex items-center justify-around px-4 bg-white shrink-0 relative z-30">
        <Link to="/mobile" className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors group">
          <div className="p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
            <Home className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
        </Link>
        <Link to="/mobile/portfolio" className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors group">
          <div className="p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
            <PieChart className="w-6 h-6" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Wealth</span>
        </Link>
        <Link to="/mobile/advice" className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors group">
           <div className="p-2 rounded-full group-hover:bg-indigo-50 transition-colors">
             <Zap className="w-6 h-6" />
           </div>
           <span className="text-[10px] font-bold uppercase tracking-wider">Advice</span>
        </Link>
        <Link to="/mobile/messages" className="flex flex-col items-center gap-1 text-slate-400 hover:text-indigo-600 transition-colors group">
          <div className="p-2 rounded-full group-hover:bg-indigo-50 transition-colors relative">
            <MessageSquare className="w-6 h-6" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full border border-white"></span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider">Chat</span>
        </Link>
      </nav>
      
      {/* Platform Switcher for Demo */}
      <Link to="/internal" className="absolute top-12 left-1/2 -translate-x-1/2 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold text-white z-50 border border-white/20 hover:bg-white/30 transition-all uppercase tracking-widest leading-none">
        Internal View
      </Link>
    </div>
  </div>
);

// --- Sub-Pages (Minimal implementation for preview) ---

const InternalDashboard = () => (
  <InternalDashboardContent />
);

const InternalDashboardContent = () => {
  const { portalCaps } = useAuth();
  const canCreateCase = portalCaps.canCreateCase;
  const [cases, setCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    wealthApi
      .listCases()
      .then((items) => {
        if (!mounted) return;
        setCases(items);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const isPlanningReady = (item: any) => item.phase === 'PLANNING' && item.status === 'READY';
  const pendingDiscovery = cases.filter((item) => !isPlanningReady(item)).length;
  const readyForPlanning = cases.filter((item) => isPlanningReady(item)).length;

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Active Cases', value: String(cases.length), trend: 'Live from backend', icon: Briefcase, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Pending Discovery', value: String(pendingDiscovery), trend: 'Need readiness checks', icon: Search, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Planning Ready', value: String(readyForPlanning), trend: 'Case phase PLANNING + status READY', icon: Zap, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Data Source', value: loading ? 'Loading' : 'API', trend: 'No sample dataset', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        ].map((stat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-4">
              <div className={cn("p-3 rounded-xl", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <span className="text-[10px] font-bold text-zinc-400 bg-zinc-50 px-2 py-1 rounded-md uppercase tracking-wider">{stat.trend}</span>
            </div>
            <div>
              <p className="font-serif italic text-sm text-zinc-500 mb-1">Total {stat.label}</p>
              <p className="text-3xl font-mono font-bold text-zinc-900">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
              <h3 className="font-serif italic text-lg text-zinc-900">Active Service Cases</h3>
              {canCreateCase && (
              <Link to="/internal/cases/new" className="px-4 py-2 bg-zinc-900 text-white rounded-lg text-xs font-bold hover:bg-zinc-800 transition-all flex items-center gap-2">
                <Plus className="w-4 h-4" /> Create Case
              </Link>
              )}
            </div>
            <div className="divide-y divide-zinc-100">
              <div className="grid grid-cols-5 px-6 py-3 bg-zinc-50 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                <span className="col-span-2">Client / Case ID</span>
                <span>Stage</span>
                <span>Source</span>
                <span className="text-right">Created</span>
              </div>
              {loading && <div className="px-6 py-8 text-sm text-zinc-500">Loading cases...</div>}
              {!loading && cases.length === 0 && <div className="px-6 py-8 text-sm text-zinc-500">No cases found from backend.</div>}
              {cases.slice(0, 8).map((item) => (
                <Link
                  key={item.id}
                  to={`/internal/cases/${item.id}`}
                  className="grid grid-cols-5 px-6 py-4 hover:bg-zinc-50 transition-all items-center group"
                >
                  <div className="col-span-2 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-xs">
                      {(item.clientName || 'U').slice(0, 1).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors">{item.clientName || 'Unknown Client'}</p>
                      <p className="text-[10px] font-mono text-zinc-400">{item.id} • {item.type || '-'}</p>
                    </div>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full text-zinc-500 bg-zinc-100">{item.status || 'UNKNOWN'}</span>
                  </div>
                  <div className="text-xs text-zinc-600 font-medium">Local API</div>
                  <div className="text-xs text-zinc-400 text-right">{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-'}</div>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

type MobileHomeLocationState = {
  adviceApproved?: boolean;
};

const MobileHome = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [clientOptions, setClientOptions] = useState<WorkflowCreateClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(() => getMobileClientId() ?? '');
  const [deviceId, setDeviceId] = useState('iphone-demo-001');
  const [loadingClients, setLoadingClients] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const state = location.state as MobileHomeLocationState | null | undefined;
    if (!state?.adviceApproved) return;
    setSuccessMessage('Approval successful.');
    navigate('.', { replace: true, state: {} });
  }, [location.state, navigate]);

  useEffect(() => {
    if (selectedClientId.trim()) {
      setMobileClientId(selectedClientId.trim());
    }
  }, [selectedClientId]);

  useEffect(() => {
    let mounted = true;
    const saved = getMobileClientId();

    const applySavedOnly = () => {
      if (!mounted) return;
      setLoadingClients(false);
      if (saved) {
        setClientOptions([{ clientId: saved, clientName: 'Client (saved)' }]);
        setSelectedClientId((prev) => (prev.trim() ? prev : saved));
      }
    };

    if (!getAccessToken()) {
      applySavedOnly();
      return () => {
        mounted = false;
      };
    }

    setLoadingClients(true);
    fetchMobileClientOptions()
      .then((clients) => {
        if (!mounted) return;
        setClientOptions(clients);
        if (clients.length > 0) {
          setSelectedClientId((prev) => {
            const p = prev.trim();
            if (p && clients.some((c) => c.clientId === p)) return p;
            if (p && !clients.some((c) => c.clientId === p)) return clients[0].clientId;
            return clients[0].clientId;
          });
        }
      })
      .catch((err) => {
        if (!mounted) return;
        if (saved) {
          setClientOptions([{ clientId: saved, clientName: 'Client (saved)' }]);
          setSelectedClientId((prev) => (prev.trim() ? prev : saved));
          setError(null);
        } else {
          setError(toApiError(err));
        }
      })
      .finally(() => {
        if (mounted) setLoadingClients(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleRegisterDevice = async () => {
    if (!selectedClientId) {
      setError(toApiError(new Error('Select a client first (create a case in Internal Portal if empty).')));
      return;
    }
    const trimmedDevice = deviceId.trim();
    if (!trimmedDevice) {
      setError(toApiError(new Error('Device ID is required.')));
      return;
    }
    setRegistering(true);
    try {
      await wealthApi.registerMobile({
        clientId: selectedClientId,
        deviceId: trimmedDevice,
      });
      setSuccessMessage('Device registered. Client is now ACTIVE.');
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setRegistering(false);
    }
  };

  return (
    <motion.div
      key="mobile-home"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-8"
    >
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div className="space-y-2">
        <p className="text-zinc-500 font-medium text-sm">Total Assets</p>
        <p className="text-4xl font-bold tracking-tight text-zinc-900">$1,424,500.00</p>
        <div className="flex items-center gap-2">
          <span className="text-emerald-600 text-xs font-bold bg-emerald-50 px-2 py-0.5 rounded-md">+4.2% (YTD)</span>
          <span className="text-zinc-300">•</span>
          <span className="text-zinc-400 text-xs font-medium">Updated 2m ago</span>
        </div>
      </div>

      <section className="rounded-3xl border border-emerald-100 bg-emerald-50/80 p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 rounded-2xl bg-white p-2 text-emerald-600 shadow-sm">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-zinc-900">Activate this device</p>
            <p className="text-[11px] text-zinc-600 mt-0.5 leading-relaxed">
              Calls <span className="font-mono">POST /mobile/register</span> so the client becomes ACTIVE before discovery.
            </p>
          </div>
        </div>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Client</span>
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            disabled={loadingClients || registering}
            className="w-full px-4 py-3 rounded-2xl border border-emerald-200/80 bg-white text-sm outline-none focus:ring-2 focus:ring-emerald-500/20"
          >
            {clientOptions.length === 0 && <option value="">No client — create a case in Internal Portal</option>}
            {clientOptions.map((item) => (
              <option key={item.clientId} value={item.clientId}>
                {item.clientName ?? item.clientId}
              </option>
            ))}
          </select>
          {clientOptions.length === 0 && !loadingClients && (
            <p className="text-[11px] text-zinc-600 leading-relaxed">
              Companion-only mode: open the <strong className="font-semibold text-zinc-800">Wealth</strong> tab and paste your{' '}
              <span className="font-mono text-zinc-700">clientId</span>, or sign in on Professional Portal to load clients here.
            </p>
          )}
        </label>
        <label className="block space-y-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Device ID</span>
          <input
            type="text"
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            disabled={registering}
            className="w-full px-4 py-3 rounded-2xl border border-emerald-200/80 bg-white text-sm font-mono outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleRegisterDevice()}
          disabled={registering || loadingClients || !selectedClientId}
          className={cn(
            'w-full py-3.5 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all',
            registering || loadingClients || !selectedClientId
              ? 'bg-zinc-300 text-zinc-500 cursor-not-allowed'
              : 'bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-600/20',
          )}
        >
          <Smartphone className={cn('w-4 h-4', registering && 'animate-pulse')} />
          {registering ? 'Registering…' : 'Register device (ACTIVE)'}
        </button>
        <Link
          to="/mobile/onboarding"
          className="block text-center text-[11px] font-bold text-emerald-800 underline underline-offset-2 hover:text-emerald-900"
        >
          Or continue full onboarding →
        </Link>
      </section>

      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/mobile/portfolio"
          className="p-5 bg-white border border-zinc-100 rounded-3xl shadow-sm hover:shadow-md transition-all space-y-4"
        >
          <div className="w-10 h-10 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
            <PieChart className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-900">Portfolio</p>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Drift: 2.1%</p>
          </div>
        </Link>
        <Link
          to="/mobile/advice"
          className="p-5 bg-zinc-900 border border-zinc-800 rounded-3xl shadow-sm hover:translate-y-[-2px] transition-all space-y-4 text-white relative overflow-hidden group"
        >
          <div className="absolute top-0 right-0 w-16 h-16 bg-blue-500/10 rounded-full blur-xl group-hover:bg-blue-500/20 transition-all"></div>
          <div className="w-10 h-10 bg-white/10 rounded-2xl flex items-center justify-center text-blue-400 relative z-10">
            <Zap className="w-6 h-6" />
          </div>
          <div className="relative z-10">
            <p className="text-sm font-bold">New Advice</p>
            <p className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">Action Required</p>
          </div>
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h3 className="text-lg font-bold text-zinc-900">Next Steps</h3>
          <span className="text-xs font-bold text-blue-600">2 Pending</span>
        </div>
        <div className="space-y-3">
          <Link
            to="/mobile/risk"
            className="flex items-center gap-4 p-4 bg-zinc-50 rounded-3xl border border-zinc-100 group cursor-pointer hover:bg-white transition-all"
          >
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-amber-50">
              <ShieldCheck className="w-6 h-6 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none mb-1">
                Complete Risk Profile
              </p>
              <p className="text-[11px] text-zinc-500 font-medium">Due in 2 days</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:translate-x-1 transition-transform" />
          </Link>

          <div className="flex items-center gap-4 p-4 bg-zinc-50 rounded-3xl border border-zinc-100 group cursor-pointer hover:bg-white transition-all">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-blue-50">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-zinc-900 group-hover:text-blue-600 transition-colors uppercase tracking-tight leading-none mb-1">
                Upload Address Proof
              </p>
              <p className="text-[11px] text-zinc-500 font-medium">Required for Trading</p>
            </div>
            <ChevronRight className="w-4 h-4 text-zinc-300 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const scoreToRiskProfile = (score: number): 'CONSERVATIVE' | 'BALANCED' | 'GROWTH' => {
  if (score <= 5) return 'CONSERVATIVE';
  if (score <= 10) return 'BALANCED';
  return 'GROWTH';
};

const MobileRiskPage = () => {
  const [clientOptions, setClientOptions] = useState<WorkflowCreateClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(() => getMobileClientId() ?? '');
  const [loadingClients, setLoadingClients] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (selectedClientId.trim()) {
      setMobileClientId(selectedClientId.trim());
    }
  }, [selectedClientId]);

  useEffect(() => {
    let mounted = true;
    const saved = getMobileClientId();

    if (!getAccessToken()) {
      setLoadingClients(false);
      if (saved) {
        setClientOptions([{ clientId: saved, clientName: 'Client (saved)' }]);
        setSelectedClientId((prev) => (prev.trim() ? prev : saved));
      }
      return;
    }

    const loadClientOptions = async () => {
      setLoadingClients(true);
      try {
        const clients = await fetchMobileClientOptions();
        if (!mounted) return;
        setClientOptions(clients);
        if (clients.length > 0) {
          setSelectedClientId((prev) => {
            const p = prev.trim();
            if (p && clients.some((c) => c.clientId === p)) return p;
            if (p && !clients.some((c) => c.clientId === p)) return clients[0].clientId;
            return clients[0].clientId;
          });
        }
      } catch (err) {
        if (!mounted) return;
        if (saved) {
          setClientOptions([{ clientId: saved, clientName: 'Client (saved)' }]);
          setSelectedClientId((prev) => (prev.trim() ? prev : saved));
          setError(null);
        } else {
          setError(toApiError(err));
        }
      } finally {
        if (mounted) setLoadingClients(false);
      }
    };
    void loadClientOptions();
    return () => {
      mounted = false;
    };
  }, []);

  const handleComplete = async (score: number) => {
    if (!selectedClientId) {
      setError(toApiError(new Error('Please select a client before submitting risk profile.')));
      return;
    }
    setSubmitting(true);
    try {
      const riskProfile = scoreToRiskProfile(score);
      await wealthApi.updateProfile(selectedClientId, { riskProfile });
      setSuccessMessage(`Risk profile updated successfully: ${riskProfile}`);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Client</label>
        <select
          value={selectedClientId}
          onChange={(e) => setSelectedClientId(e.target.value)}
          disabled={loadingClients || submitting}
          className="w-full px-4 py-3 border border-zinc-200 rounded-2xl text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
        >
          {clientOptions.length === 0 && <option value="">No client available</option>}
          {clientOptions.map((item) => (
            <option key={item.clientId} value={item.clientId}>
              {item.clientName ?? item.clientId}
            </option>
          ))}
        </select>
      </div>
      <RiskQuestionnaire onComplete={(score) => void handleComplete(score)} />
    </div>
  );
};

// --- App Entry ---

export default function App() {
  return (
    <AuthProvider>
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/internal/*" element={
          <RequireInternalAuth>
          <InternalLayout>
          <Routes>
            <Route path="/" element={<RequireCapability capability="canUseStaffDataApis"><InternalDashboard /></RequireCapability>} />
            <Route path="/cases" element={<RequireCapability capability="canUseStaffDataApis"><CaseListPage /></RequireCapability>} />
            <Route path="/cases/new" element={<RequireCapability capability="canCreateCase"><CaseCreationPage /></RequireCapability>} />
            <Route path="/cases/:caseId" element={<RequireCapability capability="canUseStaffDataApis"><CaseDetailPage /></RequireCapability>} />
            <Route path="/cases/:caseId/planning" element={<RequireCapability capability="canUsePlanningWorkspace"><PlanningWorkspacePage /></RequireCapability>} />
            <Route path="/cases/:caseId/execution" element={<RequireCapability capability="canUseStaffDataApis"><ExecutionConsolePage /></RequireCapability>} />
            <Route
              path="/cases/:caseId/discovery"
              element={<RequireCapability capability="canUseDiscoveryQuestionnaire"><DiscoveryQuestionnairePage /></RequireCapability>}
            />
            <Route
              path="/discovery/questions"
              element={<RequireCapability capability="canManageDiscoveryMappings"><DiscoveryQuestionsPage /></RequireCapability>}
            />
            <Route
              path="/discovery/dictionary"
              element={<RequireCapability capability="canManageDiscoveryMappings"><DiscoveryDictionaryPage /></RequireCapability>}
            />
            <Route
              path="/discovery/mappings"
              element={<RequireCapability capability="canManageDiscoveryMappings"><DiscoveryMappingPage /></RequireCapability>}
            />
            <Route path="/copilot" element={<RequireCapability capability="canUseStaffDataApis"><CopilotChat /></RequireCapability>} />
            <Route path="/workflows" element={<RequireCapability capability="canUseStaffDataApis"><RedirectLegacyWorkflowList /></RequireCapability>} />
            <Route
              path="/workflows/:workflowId"
              element={<RequireCapability capability="canUseStaffDataApis"><RedirectLegacyWorkflowDetail /></RequireCapability>}
            />
            <Route
              path="/ai-engine/workflows"
              element={<RequireCapability capability="canUseStaffDataApis"><WorkflowListPage /></RequireCapability>}
            />
            <Route
              path="/ai-engine/workflows/:workflowId"
              element={<RequireCapability capability="canUseStaffDataApis"><WorkflowDetailPage /></RequireCapability>}
            />
            <Route
              path="/ai-engine/settings"
              element={<RequireCapability capability="canManageAiEngineCatalog"><AiEngineLlmProfilesPage /></RequireCapability>}
            />
            <Route
              path="/ai-engine/case-phases"
              element={<RequireCapability capability="canManageAiEngineCatalog"><AiEngineCasePhasesPage /></RequireCapability>}
            />
            <Route
              path="/ai-engine/ai-interactions"
              element={<RequireCapability capability="canManageAiEngineCatalog"><AiEngineInteractionsPage /></RequireCapability>}
            />
            <Route
              path="/planning/templates"
              element={<RequireCapability capability="canManageAiEngineCatalog"><PlanningTemplateRegistryPage /></RequireCapability>}
            />
            <Route path="/investments" element={<RequireCapability capability="canViewInvestments"><InvestmentCockpit /></RequireCapability>} />
            <Route path="/users" element={<RequireCapability capability="canManagePortalUsers"><UserManagementPage /></RequireCapability>} />
            <Route path="*" element={<div className="p-10 text-center text-slate-400">Feature Coming Soon</div>} />
          </Routes>
          </InternalLayout>
          </RequireInternalAuth>
        } />
        
        <Route path="/mobile/*" element={
          <MobileLayout>
          <Routes>
            <Route path="/" element={<MobileHome />} />
            <Route path="/onboarding" element={<MobileOnboardingPage />} />
            <Route path="/risk" element={<MobileRiskPage />} />
            <Route path="/advice" element={<AdvicePreview />} />
            <Route path="/portfolio" element={<MobileWealthGoalsAssetsPage />} />
            <Route path="/messages" element={<div className="p-10 text-center text-slate-400">Secure Messaging Implementation...</div>} />
          </Routes>
          </MobileLayout>
        } />

        <Route path="/" element={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-white flex-col gap-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Nexus Wealth Management</h1>
            <p className="text-slate-400">Select Interface to Preview</p>
          </div>
          <div className="flex gap-4">
            <Link
              to="/login"
              state={{ from: { pathname: '/internal' } }}
              className="px-8 py-3 bg-indigo-600 rounded-2xl font-bold hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-500/20"
            >
              Professional Portal
            </Link>
            <Link to="/mobile" className="px-8 py-3 bg-white text-slate-950 rounded-2xl font-bold hover:bg-slate-100 transition-all">Client Companion</Link>
          </div>
        </div>} />
      </Routes>
    </Router>
    </AuthProvider>
  );
}

