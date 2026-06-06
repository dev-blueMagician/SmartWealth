import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  History, 
  Search, 
  Zap, 
  FileText, 
  TrendingUp, 
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  ArrowRight,
  UserRound,
  MessageCircle,
  X,
  Paperclip,
  Trash2,
  Info,
  Shield,
  Wallet,
  Target,
  ClipboardList,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  wealthApi,
  isCaseChatStreamEnabled,
  type CaseChatMessageRecord,
  type ClientProfileInfo,
  type CaseDocumentRecord,
  type ClientDiscoveryAsset,
  type ClientDiscoveryGoal,
} from '../../services/wealthApi';
import { consumeCaseChatNdjsonStream, createRafBatchedTextSink } from '../../services/caseChatStream';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';
import { CaseChatRunStepsCompact } from '../../components/CaseChatRunSteps';
import {
  DEV_CHAT_PROGRESS_SCENARIO,
  type ChatRunStepRow,
} from '../../domain/caseChatRunEvents';

function chatAttachmentsFromSnapshot(snap: CaseChatMessageRecord['contextSnapshot']): { name: string }[] {
  if (!snap || typeof snap !== 'object') return [];
  const raw = (snap as Record<string, unknown>)['attachments'];
  if (!Array.isArray(raw)) return [];
  const out: { name: string }[] = [];
  for (const item of raw) {
    if (item && typeof item === 'object' && 'originalFilename' in item) {
      const fn = (item as { originalFilename?: unknown }).originalFilename;
      if (typeof fn === 'string' && fn.trim()) out.push({ name: fn });
    }
  }
  return out;
}

export const CaseDetailPage = () => {
  const { portalCaps } = useAuth();
  const { caseId } = useParams();
  const [data, setData] = useState<any>(null);
  const [tasks, setTasks] = useState<Array<{ id: string; taskType: string; status: string; updatedAt?: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline' | 'onboarding' | 'planning' | 'execution'>('timeline');
  const [runningDiscovery, setRunningDiscovery] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [chatThreadId, setChatThreadId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<CaseChatMessageRecord[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [chatLoadError, setChatLoadError] = useState<ApiError | null>(null);
  const [chatAttachmentFiles, setChatAttachmentFiles] = useState<File[]>([]);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const chatMessagesEndRef = useRef<HTMLDivElement>(null);
  const chatInitialScrollDone = useRef(false);
  /** Bumps on case change / new send so stale listCaseChatMessages cannot overwrite UI. */
  const chatHydrateGen = useRef(0);
  const chatSendInFlightRef = useRef(false);
  const [lastTurnMeta, setLastTurnMeta] = useState<{
    intent?: string;
    phase?: string;
    assessment?: string;
  } | null>(null);

  const [chatDeleteConfirm, setChatDeleteConfirm] = useState(false);
  const [chatDeleting, setChatDeleting] = useState(false);
  /** Populated by future NDJSON stream; in dev, simulated while {@link chatSending}. */
  const [chatRunSteps, setChatRunSteps] = useState<ChatRunStepRow[]>([]);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<ClientProfileInfo | null>(null);
  const [profileDocs, setProfileDocs] = useState<CaseDocumentRecord[]>([]);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileAssets, setProfileAssets] = useState<ClientDiscoveryAsset[]>([]);
  const [profileGoals, setProfileGoals] = useState<ClientDiscoveryGoal[]>([]);

  useEffect(() => {
    if (chatMessages.length === 0 && !chatSending) return;
    const isInitial = !chatInitialScrollDone.current;
    requestAnimationFrame(() => {
      chatMessagesEndRef.current?.scrollIntoView({
        behavior: chatSending ? 'instant' : isInitial ? 'instant' : 'smooth',
        block: 'end',
      });
      if (isInitial) {
        chatInitialScrollDone.current = true;
      }
    });
  }, [chatMessages, chatSending]);

  useEffect(() => {
    if (!caseId) return;
    let mounted = true;
    const hydrateGen = ++chatHydrateGen.current;
    chatInitialScrollDone.current = false;
    setChatLoadError(null);
    (async () => {
      try {
        const th = await wealthApi.getCaseChatThread(caseId);
        if (!mounted || hydrateGen !== chatHydrateGen.current) return;
        setChatThreadId(th.id);
        const msgs = await wealthApi.listCaseChatMessages(caseId, th.id);
        if (!mounted || hydrateGen !== chatHydrateGen.current) return;
        setChatMessages(msgs);
      } catch (err) {
        if (!mounted || hydrateGen !== chatHydrateGen.current) return;
        setChatLoadError(toApiError(err));
      }
    })();
    return () => {
      mounted = false;
    };
  }, [caseId]);

  useEffect(() => {
    if (!chatSending) {
      setChatRunSteps([]);
      return;
    }
    const viteDev =
      (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV === true;
    if (!viteDev || isCaseChatStreamEnabled) {
      return;
    }
    const scenario = DEV_CHAT_PROGRESS_SCENARIO;
    const stepMs = 480;
    let cancelled = false;
    setChatRunSteps([{ ...scenario[0], status: 'active' }]);
    const timers: number[] = [];
    for (let s = 0; s < scenario.length - 1; s++) {
      timers.push(
        window.setTimeout(() => {
          if (cancelled) return;
          const donePart = scenario.slice(0, s + 1).map((row) => ({
            ...row,
            status: 'done' as const,
          }));
          const next = scenario[s + 1];
          setChatRunSteps([...donePart, { ...next, status: 'active' }]);
        }, stepMs * (s + 1)),
      );
    }
    const clearAfterMs = stepMs * Math.max(0, scenario.length - 1) + 650;
    timers.push(
      window.setTimeout(() => {
        if (cancelled) return;
        setChatRunSteps([]);
      }, clearAfterMs),
    );
    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
    };
  }, [chatSending]);

  const handleSendChat = async () => {
    if (!caseId || !chatThreadId) return;
    if (chatSendInFlightRef.current || chatSending) return;
    const text = chatInput.trim();
    if (!text && chatAttachmentFiles.length === 0) return;
    chatSendInFlightRef.current = true;

    const optimisticMsg = {
      id: `optimistic-${Date.now()}`,
      body: text,
      senderKind: 'USER',
      actorRole: 'RM',
      intentCode: null,
      contextSnapshot: chatAttachmentFiles.length > 0
        ? { attachments: chatAttachmentFiles.map(f => ({ originalFilename: f.name })) }
        : null,
    } as unknown as CaseChatMessageRecord;

    setChatMessages((prev) => [...prev, optimisticMsg]);
    setChatInput('');
    const filesToUpload = [...chatAttachmentFiles];
    setChatAttachmentFiles([]);
    const turnGen = ++chatHydrateGen.current;
    setChatSending(true);
    setChatLoadError(null);
    let streamMsgId: string | null = null;

    try {
      const attachmentIds: string[] = [];
      for (const file of filesToUpload) {
        const up = await wealthApi.uploadCaseChatAttachment(caseId, file);
        attachmentIds.push(up.caseDocumentId);
      }
      const chatPayload = {
        threadId: chatThreadId,
        message: text,
        autoDetectIntent: true,
        attachmentIds: attachmentIds.length ? attachmentIds : null,
      };

      if (isCaseChatStreamEnabled) {
        streamMsgId = `streaming-${Date.now()}`;
        const streamingAssistant = {
          id: streamMsgId,
          threadId: chatThreadId,
          body: '',
          senderKind: 'ASSISTANT',
          actorRole: 'AI_ENGINE',
          visibility: 'ALL',
          intentCode: null,
        } as unknown as CaseChatMessageRecord;
        setChatMessages((prev) => [...prev, streamingAssistant]);
        setChatRunSteps([]);

        let streamError: string | null = null;
        let streamAssistantMessageId: string | null = null;
        const messageCountBefore = chatMessages.filter((m) => !String(m.id).startsWith('optimistic-')
          && !String(m.id).startsWith('streaming-')).length;
        if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
          console.info('[case-chat-stream] sending', { caseId, threadId: chatThreadId });
        }
        const streamTextSink = createRafBatchedTextSink((fullText) => {
          setChatMessages((prev) =>
            prev.map((m) => (m.id === streamMsgId ? { ...m, body: fullText } : m)),
          );
        });

        try {
          const response = await wealthApi.sendCaseChatMessageStream(caseId, chatPayload);
          await consumeCaseChatNdjsonStream(response, {
            onPhase: (steps) => setChatRunSteps(steps),
            onAssistantDelta: (fullText) => {
              streamTextSink.push(fullText);
            },
            onDone: (ev) => {
              streamAssistantMessageId = ev.assistantMessageId ?? null;
            },
            onError: (message) => {
              streamError = message;
            },
          });
        } finally {
          streamTextSink.flush();
        }

        if (streamError) {
          throw new Error(streamError);
        }

        const msgs = await wealthApi.listCaseChatMessages(caseId, chatThreadId);
        const persistedAssistant = streamAssistantMessageId
          ? msgs.find((m) => m.id === streamAssistantMessageId)
          : null;
        const lastPersisted = msgs.length > 0 ? msgs[msgs.length - 1] : null;
        const hasNewAssistant =
          (persistedAssistant != null && (persistedAssistant.body?.trim().length ?? 0) > 0)
          || (lastPersisted?.senderKind === 'ASSISTANT'
            && (lastPersisted.body?.trim().length ?? 0) > 0
            && msgs.length > messageCountBefore);
        if (!hasNewAssistant) {
          throw new Error(
            'Không nhận được phản hồi AI (tin nhắn trợ lý chưa được lưu). Vui lòng thử lại.',
          );
        }
        if (turnGen === chatHydrateGen.current) {
          setChatMessages(msgs);
        }
        if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) {
          console.info(
            '[case-chat-stream] reloaded messages',
            msgs.map((m) => ({
              id: m.id,
              kind: m.senderKind,
              bodyLen: m.body?.length ?? 0,
            })),
          );
        }
        setChatRunSteps([]);
        refreshCaseData();
        if (profileOpen) loadProfileInfo();
      } else {
        const res = await wealthApi.sendCaseChatMessage(caseId, chatPayload);
        setLastTurnMeta({
          intent: typeof res.intent === 'string' ? res.intent : undefined,
          phase: typeof res.resolvedPhaseCode === 'string' ? res.resolvedPhaseCode : undefined,
          assessment:
            typeof res.resolvedAssessmentCode === 'string' ? res.resolvedAssessmentCode : undefined,
        });
        const msgs = await wealthApi.listCaseChatMessages(caseId, chatThreadId);
        if (turnGen === chatHydrateGen.current) {
          setChatMessages(msgs);
        }
        refreshCaseData();
        if (profileOpen) loadProfileInfo();
      }
    } catch (err) {
      setChatLoadError(toApiError(err));
      setChatMessages((prev) =>
        prev.filter(
          (m) => m.id !== optimisticMsg.id && (streamMsgId == null || m.id !== streamMsgId),
        ),
      );
      setChatInput(text);
      setChatAttachmentFiles(filesToUpload);
    } finally {
      chatSendInFlightRef.current = false;
      setChatSending(false);
    }
  };

  const handleDeleteChatHistory = async () => {
    if (!caseId || !chatThreadId) return;
    setChatDeleting(true);
    try {
      await wealthApi.deleteCaseChatHistory(caseId, chatThreadId);
      ++chatHydrateGen.current;
      chatInitialScrollDone.current = false;
      setChatMessages([]);
      setLastTurnMeta(null);
      setChatDeleteConfirm(false);
      setSuccessMessage('Chat history cleared.');
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setChatDeleting(false);
    }
  };

  const refreshCaseData = useCallback(async () => {
    if (!caseId) return;
    try {
      const [caseData, caseTasks] = await Promise.all([
        wealthApi.getCase(caseId),
        wealthApi.listCaseTasks(caseId),
      ]);
      setData(caseData);
      setTasks(caseTasks);
    } catch (err) {
      console.error('CaseDetail refresh error:', err);
    }
  }, [caseId]);

  const loadProfileInfo = useCallback(async () => {
    if (!caseId) return;
    setProfileLoading(true);
    try {
      const [profile, docs] = await Promise.all([
        wealthApi.getCaseClientProfile(caseId),
        wealthApi.listCaseDocuments(caseId),
      ]);
      setProfileData(profile);
      setProfileDocs(docs);
      if (profile.clientId) {
        const [assets, goals] = await Promise.all([
          wealthApi.listAssets(profile.clientId).catch(() => [] as ClientDiscoveryAsset[]),
          wealthApi.listGoals(profile.clientId).catch(() => [] as ClientDiscoveryGoal[]),
        ]);
        setProfileAssets(assets);
        setProfileGoals(goals);
      }
    } catch (err) {
      console.error('Profile info load error:', err);
    } finally {
      setProfileLoading(false);
    }
  }, [caseId]);

  const handleOpenProfile = useCallback(() => {
    setProfileOpen(true);
    if (!caseId) return;
    setProfileLoading(true);
    Promise.all([
      wealthApi.getCaseClientProfile(caseId),
      wealthApi.listCaseDocuments(caseId),
    ])
      .then(async ([profile, docs]) => {
        setProfileData(profile);
        setProfileDocs(docs);
        if (profile.clientId) {
          const [assets, goals] = await Promise.all([
            wealthApi.listAssets(profile.clientId).catch(() => [] as ClientDiscoveryAsset[]),
            wealthApi.listGoals(profile.clientId).catch(() => [] as ClientDiscoveryGoal[]),
          ]);
          setProfileAssets(assets);
          setProfileGoals(goals);
        }
      })
      .catch((err) => {
        console.error('Profile info load error:', err);
      })
      .finally(() => {
        setProfileLoading(false);
      });
  }, [caseId]);

  useEffect(() => {
    if (!caseId) {
      setLoading(false);
      return;
    }
    let mounted = true;
    Promise.all([wealthApi.getCase(caseId), wealthApi.listCaseTasks(caseId)])
      .then(([caseData, caseTasks]) => {
        if (!mounted) return;
        setData(caseData);
        setTasks(caseTasks);
      })
      .catch((err) => {
        console.error('CaseDetail fetch error:', err);
        setError(toApiError(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [caseId]);

  const handleRunDiscovery = async () => {
    if (!caseId) return;
    setRunningDiscovery(true);
    try {
      const response = await wealthApi.checkDiscovery(caseId);
      setData((prev: any) => ({
        ...prev,
        phase: response.casePhase ?? response.phase ?? prev?.phase,
        status: response.caseStatus ?? response.status ?? prev?.status,
      }));
      const refreshedTasks = await wealthApi.listCaseTasks(caseId);
      setTasks(refreshedTasks);
      setSuccessMessage('Discovery check completed successfully.');
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setRunningDiscovery(false);
    }
  };

  const timelineEvents = useMemo(() => {
    const baseEvent = data
      ? [
          {
            status: 'SUCCESS',
            label: 'Case Created',
            time: data.createdAt ? new Date(data.createdAt).toLocaleString() : 'N/A',
            desc: `Case ${data.id} was created for ${data.clientName || data.clientId || 'client'}.`,
          },
        ]
      : [];
    const taskEvents = tasks.map((task) => ({
      status: task.status === 'COMPLETED' ? 'SUCCESS' : task.status === 'PENDING' ? 'PENDING' : 'REJECTED',
      label: task.taskType,
      time: task.updatedAt ? new Date(task.updatedAt).toLocaleString() : 'N/A',
      desc: `Task status: ${task.status}`,
    }));
    return [...taskEvents, ...baseEvent];
  }, [data, tasks]);

  const completionRate = tasks.length
    ? Math.round((tasks.filter((task) => task.status === 'COMPLETED').length / tasks.length) * 100)
    : 0;

  const mainTabs = useMemo(() => {
    const base: Array<{
      id: 'timeline' | 'onboarding' | 'planning' | 'execution';
      label: string;
      icon: typeof History;
    }> = [
      { id: 'timeline', label: 'Case Timeline', icon: History },
      { id: 'onboarding', label: 'Onboarding (KYC)', icon: Search },
    ];
    if (portalCaps.canUsePlanningWorkspace) {
      base.push({ id: 'planning', label: 'Wealth Planning', icon: FileText });
    }
    base.push({ id: 'execution', label: 'Execution Desk', icon: Zap });
    return base;
  }, [portalCaps.canUsePlanningWorkspace]);

  useEffect(() => {
    if (!mainTabs.some((t) => t.id === activeTab)) {
      setActiveTab('timeline');
    }
  }, [mainTabs, activeTab]);

  if (loading) return <div className="p-20 text-center animate-pulse italic font-serif text-zinc-400">Contextualizing Case Data...</div>;
  if (!data) return <div className="p-20 text-center text-zinc-400">Case not found.</div>;

  return (
    <div className="flex gap-6">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      {/* Main content – flows naturally, scrolled by parent <main> */}
      <div className="flex-1 min-w-0 space-y-8">
        {/* Entity Header */}
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
               <Link to="/internal/cases" className="text-zinc-400 hover:text-zinc-900 transition-colors">Case Portfolio</Link>
               <ChevronRight className="w-4 h-4 text-zinc-300" />
               <span className="font-mono text-zinc-900 font-bold">{data.id.slice(0, 8).toUpperCase()}</span>
            </div>
            <h1 className="text-3xl font-serif italic text-zinc-900">{data.type || 'Service Case'}</h1>
            <div className="flex items-center gap-4 mt-2">
               <span className={cn(
                 "text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md",
                 data.phase === 'ONBOARDING' ? "text-blue-600 bg-blue-50" :
                 data.phase === 'PLANNING' ? "text-amber-600 bg-amber-50" :
                 data.phase === 'EXECUTION' ? "text-emerald-600 bg-emerald-50" :
                 data.phase === 'MONITORING' ? "text-purple-600 bg-purple-50" :
                 "text-zinc-600 bg-zinc-100"
               )}>Phase: {data.phase || 'N/A'}</span>
               <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 bg-zinc-100 text-zinc-600 rounded-md">Status: {data.status}</span>
               <span className="text-[10px] text-zinc-400 font-medium">Client: <span className="text-zinc-900">{data.clientName || data.clientId || 'N/A'}</span></span>
               <span className="text-[10px] text-zinc-400 font-medium">Created: <span className="text-zinc-900">{data.createdAt ? new Date(data.createdAt).toLocaleDateString() : '-'}</span></span>
                <button
                  type="button"
                  onClick={handleOpenProfile}
                  className="mt-4 flex items-center gap-2 w-full justify-center rounded-xl bg-blue-50 px-4 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  <Info className="w-4 h-4" />
                  Profile Info &amp; Documents
                </button>            
            </div>
          </div>
          {/* {portalCaps.canRunDiscoveryCheck && (
            <div className="flex gap-3">
              <button
                onClick={handleRunDiscovery}
                disabled={runningDiscovery}
                className={cn(
                  "px-6 py-2 bg-zinc-900 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-all",
                  runningDiscovery ? "opacity-50 cursor-not-allowed" : "hover:bg-zinc-800"
                )}
              >
                {runningDiscovery ? <Clock className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Run Full Discovery Workflow
              </button>
            </div>
          )} */}
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-zinc-100">
          {mainTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-6 py-4 text-xs font-bold uppercase tracking-widest transition-all relative",
                activeTab === tab.id ? "text-zinc-900" : "text-zinc-400 hover:text-zinc-600"
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div layoutId="activeTabUnderline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-zinc-900" />
              )}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
             <AnimatePresence mode="wait">
                {activeTab === 'timeline' && (
                  <motion.div 
                     key="timeline"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="space-y-6"
                  >
                     <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
                        <h3 className="font-serif italic text-xl mb-8">Case Timeline (API)</h3>
                        <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[2px] before:bg-zinc-100">
                           {timelineEvents.map((event, i) => (
                             <div key={i} className="relative pl-10">
                                <div className={cn(
                                  "absolute left-0 top-1 w-6 h-6 rounded-full border-4 border-white shadow-sm flex items-center justify-center",
                                  event.status === 'SUCCESS' ? "bg-emerald-500" : 
                                  event.status === 'REJECTED' ? "bg-rose-500" : "bg-blue-500"
                                )}>
                                   {event.status === 'SUCCESS' ? <CheckCircle2 className="w-3 h-3 text-white" /> : 
                                    event.status === 'REJECTED' ? <AlertCircle className="w-3 h-3 text-white" /> : 
                                    <Clock className="w-3 h-3 text-white animate-spin" />}
                                </div>
                                <div className="grid grid-cols-4 items-start gap-4">
                                   <div className="col-span-3">
                                      <p className="text-sm font-bold text-zinc-900">{event.label}</p>
                                      <p className="text-xs text-zinc-500 mt-1">{event.desc}</p>
                                   </div>
                                   <div className="text-right">
                                      <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-widest">{event.time}</p>
                                   </div>
                                </div>
                             </div>
                           ))}
                        </div>
                     </div>
                  </motion.div>
                )}

                {activeTab === 'onboarding' && (
                  <motion.div 
                     key="onboarding"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="bg-white rounded-3xl border border-zinc-200 p-8 shadow-sm">
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                        <div>
                          <h3 className="font-serif italic text-xl mb-1">Onboarding Tasks (API)</h3>
                          <p className="text-zinc-500 text-sm">Live task statuses from backend case task records.</p>
                        </div>
                        {portalCaps.canUseDiscoveryQuestionnaire && caseId ? (
                          <Link
                            to={`/internal/cases/${caseId}/discovery`}
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-500 shadow-sm"
                          >
                            <ClipboardList className="w-4 h-4" />
                            Discovery questionnaire
                          </Link>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         {tasks.length === 0 && <p className="text-sm text-zinc-400">No task records found.</p>}
                         {tasks.map((check, i) => (
                           <div key={i} className="p-6 bg-zinc-50 rounded-2xl border border-zinc-100 flex flex-col justify-between h-32">
                              <div className="flex justify-between items-start">
                                 <p className="text-xs font-bold text-zinc-900 uppercase tracking-tight">{check.taskType}</p>
                                 <span className={cn(
                                   "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full",
                                   check.status === 'COMPLETED' ? "bg-emerald-100 text-emerald-700" : 
                                   check.status === 'PENDING' ? "bg-zinc-200 text-zinc-600" : "bg-blue-100 text-blue-700"
                                 )}>{check.status}</span>
                              </div>
                              <div className="space-y-2">
                                 <div className="h-1.5 w-full bg-zinc-200 rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: check.status === 'COMPLETED' ? '100%' : check.status === 'PENDING' ? '30%' : '60%' }}
                                      className="h-full bg-zinc-900"
                                    />
                                 </div>
                                 <p className="text-[9px] font-mono text-zinc-400">
                                   Last update: {check.updatedAt ? new Date(check.updatedAt).toLocaleString() : 'N/A'}
                                 </p>
                              </div>
                           </div>
                         ))}
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'planning' && portalCaps.canUsePlanningWorkspace && (
                  <motion.div 
                     key="planning"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center space-y-6">
                       <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mx-auto text-zinc-300">
                          <FileText className="w-10 h-10" />
                       </div>
                       <div className="space-y-2">
                          <h3 className="text-2xl font-serif italic">Investment Strategy Draft</h3>
                          <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                             Design a personalized wealth allocation based on discovery insights.
                          </p>
                       </div>
                       <Link 
                         to={`/internal/cases/${caseId}/planning`}
                         className="inline-flex items-center gap-2 px-8 py-3 bg-zinc-900 border border-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-900/10"
                       >
                          Open Workspace <ArrowRight className="w-4 h-4" />
                       </Link>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'execution' && (
                  <motion.div 
                     key="execution"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                  >
                    <div className="bg-white rounded-3xl border border-zinc-200 p-12 text-center space-y-6">
                       <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto text-blue-600">
                          <Zap className="w-10 h-10" />
                       </div>
                       <div className="space-y-2">
                          <h3 className="text-2xl font-serif italic">Execution Protocol</h3>
                          <p className="text-sm text-zinc-500 max-w-sm mx-auto">
                             Transmit finalized trades to global markets and custodians.
                          </p>
                       </div>
                       <Link 
                         to={`/internal/cases/${caseId}/execution`}
                         className="inline-flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/10"
                       >
                          Enter Trading Console <ArrowRight className="w-4 h-4" />
                       </Link>
                    </div>
                  </motion.div>
                )}

             </AnimatePresence>
          </div>

          <div className="space-y-8">
             <section className="bg-zinc-900 rounded-3xl p-6 text-white border border-zinc-800 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                <div className="flex items-center justify-between mb-6">
                   <h3 className="font-serif italic text-lg tracking-tight">Case Summary</h3>
                   <TrendingUp className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="space-y-6 relative z-10">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Client</p>
                         <p className="text-lg font-mono font-bold">{data.clientName || 'N/A'}</p>
                      </div>
                      <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                         <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Completion</p>
                         <p className="text-lg font-mono font-bold">{completionRate}%</p>
                      </div>
                   </div>
                   <div className="p-4 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                      <p className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                         <Zap className="w-3 h-3" /> Current Phase
                      </p>
                      <p className="text-lg font-mono font-bold text-white mb-1">{data.phase || 'UNKNOWN'}</p>
                      <p className="text-[10px] text-zinc-400">Status: {data.status || 'UNKNOWN'}</p>
                   </div>
                </div>
             </section>

             <section className="bg-white rounded-3xl border border-zinc-200 p-6 shadow-sm">
                <h3 className="font-serif italic text-lg mb-4 text-zinc-900">Client Profile</h3>
                <div className="flex items-center gap-3 p-3 bg-zinc-50 rounded-2xl border border-zinc-100">
                   <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                     <UserRound className="w-5 h-5" />
                   </div>
                   <div>
                      <p className="text-xs font-bold text-zinc-900">{data.clientName || 'Unknown Client'}</p>
                      <p className="text-[10px] text-zinc-500">Client ID: {data.clientId || 'N/A'}</p>
                   </div>
                </div>
                <div className="mt-4 pt-4 border-t border-zinc-100">
                   <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Case Metadata</p>
                   <div className="flex items-start gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 shrink-0"></div>
                      <p className="text-xs text-zinc-600 leading-relaxed">
                         {`Type: ${data.type || '-'} | Created: ${data.createdAt ? new Date(data.createdAt).toLocaleString() : '-'}`}
                      </p>
                   </div>
                </div>
             </section>
          </div>
        </div>
      </div>

      {/* Pinned Chat Panel – sticky right side */}
      <aside className="w-[380px] shrink-0 sticky bottom-0 self-end h-[calc(100vh-160px)] flex flex-col bg-white rounded-2xl border-2 border-zinc-300 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between gap-2 bg-zinc-900 px-5 py-4 shrink-0">
          <div className="min-w-0">
            <h3 className="font-serif italic text-base text-white leading-tight truncate flex items-center gap-2">
              <MessageCircle className="w-4 h-4 shrink-0" />
              AI Chat
            </h3>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-wide truncate mt-0.5">
              Phase {data.phase ?? '—'} · Thread persisted
            </p>
          </div>
          <span className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setChatDeleteConfirm(true)}
              disabled={chatSending || !chatThreadId || chatMessages.length === 0}
              title="Clear chat history"
              className={cn(
                'rounded-lg p-1.5 text-zinc-400 transition-colors',
                chatSending || !chatThreadId || chatMessages.length === 0
                  ? 'cursor-not-allowed opacity-30'
                  : 'hover:bg-white/10 hover:text-rose-400',
              )}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-widest">Live</span>
            </span>
          </span>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-4">
          {chatLoadError && <p className="text-xs text-rose-600">{chatLoadError.message}</p>}
          {!chatThreadId && !chatLoadError && (
            <p className="text-sm text-zinc-400">Loading conversation…</p>
          )}
          {lastTurnMeta && (lastTurnMeta.intent || lastTurnMeta.phase || lastTurnMeta.assessment) && (
            <div className="shrink-0 rounded-xl bg-emerald-50/60 px-3 py-2 text-[11px] text-emerald-900">
              <span className="font-bold">Last routing: </span>
              {lastTurnMeta.intent && <span className="mr-2">intent={lastTurnMeta.intent}</span>}
              {lastTurnMeta.phase && <span className="mr-2">phase={lastTurnMeta.phase}</span>}
              {lastTurnMeta.assessment && (
                <span className="font-mono">assessment={lastTurnMeta.assessment}</span>
              )}
            </div>
          )}
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto rounded-2xl bg-zinc-50/50 border border-zinc-200 p-3">
            {chatMessages.length === 0 && chatThreadId && (
              <p className="text-sm text-zinc-400">No messages yet. Ask about this client in natural language.</p>
            )}
            {chatMessages.map((m) => {
              const snapAtt = chatAttachmentsFromSnapshot(m.contextSnapshot);
              return (
              <div
                key={m.id}
                className={cn(
                  'max-w-[95%] rounded-2xl px-3 py-2 text-sm',
                  m.senderKind === 'ASSISTANT'
                    ? 'ml-0 bg-white text-zinc-800 shadow-sm'
                    : 'ml-auto bg-zinc-900 text-white',
                )}
              >
                <p className="mb-1 text-[10px] uppercase tracking-widest opacity-70">
                  {m.senderKind} · {m.actorRole}
                  {m.intentCode ? ` · ${m.intentCode}` : ''}
                </p>
                <pre
                  className={cn(
                    'whitespace-pre-wrap font-sans text-[13px] leading-snug',
                    String(m.id).startsWith('streaming-') &&
                      chatSending &&
                      'contain-layout [overflow-wrap:anywhere]',
                  )}
                >
                  {m.body}
                </pre>
                {snapAtt.length > 0 && (
                  <ul className="mt-2 list-disc pl-4 text-[11px] opacity-80">
                    {snapAtt.map((a, i) => (
                      <li key={`${m.id}-att-${i}`}>{a.name}</li>
                    ))}
                  </ul>
                )}
              </div>
              );
            })}
            {chatSending && (
              <div className="ml-0 max-w-[95%] rounded-2xl bg-white px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:0ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:150ms]" />
                  <span className="inline-block h-2 w-2 animate-bounce rounded-full bg-zinc-400 [animation-delay:300ms]" />
                </div>
                <CaseChatRunStepsCompact steps={chatRunSteps} fallbackLabel="Đang xử lý…" />
              </div>
            )}
            <div ref={chatMessagesEndRef} />
          </div>
          <div className="shrink-0 flex flex-col gap-2 pt-3 border-t border-zinc-100">
            <input
              ref={chatFileInputRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                const list = e.target.files ? Array.from(e.target.files) : [];
                if (list.length) setChatAttachmentFiles((prev) => [...prev, ...list]);
                e.target.value = '';
              }}
            />
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), void handleSendChat())}
              placeholder="Ask or instruct the AI…"
              rows={2}
              className="w-full rounded-xl bg-zinc-50 border border-zinc-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10 resize-none"
            />
            {chatAttachmentFiles.length > 0 && (
              <ul className="flex flex-wrap gap-2 text-[11px] text-zinc-600">
                {chatAttachmentFiles.map((f, idx) => (
                  <li
                    key={`${f.name}-${idx}`}
                    className="flex max-w-full items-center gap-1 rounded-full bg-zinc-100 px-2 py-1"
                  >
                    <span className="truncate font-mono">{f.name}</span>
                    <button
                      type="button"
                      className="shrink-0 rounded-full p-0.5 text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700"
                      aria-label={`Remove ${f.name}`}
                      onClick={() =>
                        setChatAttachmentFiles((prev) => prev.filter((_, i) => i !== idx))
                      }
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => chatFileInputRef.current?.click()}
                disabled={chatSending || !chatThreadId}
                className={cn(
                  'flex items-center gap-1.5 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700',
                  chatSending || !chatThreadId ? 'cursor-not-allowed opacity-50' : 'hover:bg-zinc-200/80',
                )}
              >
                <Paperclip className="h-3.5 w-3.5" />
                Attach
              </button>
              <button
                type="button"
                onClick={handleSendChat}
                disabled={
                  chatSending ||
                  !chatThreadId ||
                  (!chatInput.trim() && chatAttachmentFiles.length === 0)
                }
                className={cn(
                  'flex items-center gap-1.5 rounded-xl bg-zinc-900 px-5 py-2 text-xs font-bold text-white',
                  chatSending || !chatThreadId || (!chatInput.trim() && chatAttachmentFiles.length === 0)
                    ? 'cursor-not-allowed opacity-50'
                    : 'hover:bg-zinc-800',
                )}
              >
                {chatSending ? <Clock className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
                Send
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Delete Chat Confirmation Dialog */}
      <AnimatePresence>
        {chatDeleteConfirm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => !chatDeleting && setChatDeleteConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-2xl border border-zinc-200"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center shrink-0">
                  <Trash2 className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-zinc-900">Clear Chat History</h3>
                  <p className="text-sm text-zinc-500 mt-1">
                    This will permanently delete all {chatMessages.length} message{chatMessages.length !== 1 ? 's' : ''} in this conversation. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  type="button"
                  onClick={() => setChatDeleteConfirm(false)}
                  disabled={chatDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteChatHistory}
                  disabled={chatDeleting}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition-colors disabled:opacity-50 flex items-center gap-1.5"
                >
                  {chatDeleting && <Clock className="w-3.5 h-3.5 animate-spin" />}
                  {chatDeleting ? 'Deleting…' : 'Delete All'}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Profile Info Slide-over */}
      <AnimatePresence>
        {profileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
              onClick={() => setProfileOpen(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed right-0 top-0 z-50 h-full w-full max-w-lg bg-white shadow-2xl border-l border-zinc-200 flex flex-col"
            >
              <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
                <h2 className="text-xl font-serif italic text-zinc-900 flex items-center gap-2">
                  <UserRound className="w-5 h-5 text-blue-600" />
                  Profile Info &amp; Documents
                </h2>
                <button
                  type="button"
                  onClick={() => setProfileOpen(false)}
                  className="p-2 rounded-xl hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {profileLoading && (
                  <div className="flex items-center justify-center py-12">
                    <Clock className="w-5 h-5 animate-spin text-zinc-400" />
                    <span className="ml-2 text-sm text-zinc-400">Loading profile…</span>
                  </div>
                )}

                {!profileLoading && profileData && (
                  <>
                    {/* Client Identity */}
                    <section className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                          <UserRound className="w-6 h-6" />
                        </div>
                        <div>
                          <p className="text-lg font-bold text-zinc-900">{profileData.name || 'Unknown'}</p>
                          <p className="text-xs text-zinc-500 font-mono">{profileData.clientId || 'N/A'}</p>
                        </div>
                        {profileData.status && (
                          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">
                            {profileData.status}
                          </span>
                        )}
                      </div>
                    </section>

                    {/* Profile Details */}
                    <section className="bg-zinc-50 rounded-2xl border border-zinc-100 p-5 space-y-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" /> Profile Details
                      </h3>
                      <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                        {([
                          ['Risk Profile', profileData.riskProfile],
                          ['Residency', profileData.residency],
                          ['Date of Birth', profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString() : null],
                          ['Marital Status', profileData.maritalStatus],
                          ['Nationality', profileData.nationality],
                          ['Phone', profileData.primaryPhone],
                          ['Email', profileData.primaryEmail],
                          ['Registered', profileData.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : null],
                        ] as [string, string | null | undefined][]).map(([label, value]) => (
                          <div key={label}>
                            <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">{label}</p>
                            <p className="text-sm text-zinc-900 mt-0.5">{value || '—'}</p>
                          </div>
                        ))}
                      </div>
                      {profileData.contactAddress && (
                        <div className="pt-2 border-t border-zinc-200">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Address</p>
                          <p className="text-sm text-zinc-900 mt-0.5">{profileData.contactAddress}</p>
                        </div>
                      )}
                    </section>

                    {/* Documents */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <FileText className="w-3.5 h-3.5" /> Case Documents
                        <span className="ml-auto text-[10px] font-mono text-zinc-500">{profileDocs.length} file{profileDocs.length !== 1 ? 's' : ''}</span>
                      </h3>
                      {profileDocs.length === 0 && (
                        <p className="text-sm text-zinc-400 py-4 text-center">No documents uploaded yet.</p>
                      )}
                      <div className="space-y-2">
                        {profileDocs.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors"
                          >
                            <div className={cn(
                              'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
                              doc.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-600' :
                              doc.status === 'REJECTED' ? 'bg-rose-50 text-rose-600' :
                              'bg-blue-50 text-blue-600'
                            )}>
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-900 truncate">{doc.originalFilename || 'Untitled'}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[10px] text-zinc-400 font-mono">{doc.docKind || 'UPLOAD'}</span>
                                {doc.phaseCode && <span className="text-[10px] text-zinc-400">{doc.phaseCode}</span>}
                                {doc.byteSize != null && (
                                  <span className="text-[10px] text-zinc-400">
                                    {doc.byteSize < 1024 ? `${doc.byteSize} B` :
                                     doc.byteSize < 1024 * 1024 ? `${(doc.byteSize / 1024).toFixed(1)} KB` :
                                     `${(doc.byteSize / (1024 * 1024)).toFixed(1)} MB`}
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={cn(
                              'text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full shrink-0',
                              doc.status === 'VERIFIED' ? 'bg-emerald-100 text-emerald-700' :
                              doc.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                              'bg-zinc-100 text-zinc-600'
                            )}>
                              {doc.status || 'PENDING'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Assets */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Wallet className="w-3.5 h-3.5" /> Assets
                        <span className="ml-auto text-[10px] font-mono text-zinc-500">{profileAssets.length} item{profileAssets.length !== 1 ? 's' : ''}</span>
                      </h3>
                      {profileAssets.length === 0 && (
                        <p className="text-sm text-zinc-400 py-4 text-center">No assets recorded yet.</p>
                      )}
                      <div className="space-y-2">
                        {profileAssets.map((asset, idx) => (
                          <div
                            key={asset.id || idx}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-amber-50 text-amber-600">
                              <Wallet className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-900">{asset.assetType || 'Unknown Type'}</p>
                              {asset.value != null && (
                                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                  Value: {asset.value.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>

                    {/* Goals */}
                    <section className="space-y-3">
                      <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                        <Target className="w-3.5 h-3.5" /> Goals
                        <span className="ml-auto text-[10px] font-mono text-zinc-500">{profileGoals.length} item{profileGoals.length !== 1 ? 's' : ''}</span>
                      </h3>
                      {profileGoals.length === 0 && (
                        <p className="text-sm text-zinc-400 py-4 text-center">No goals recorded yet.</p>
                      )}
                      <div className="space-y-2">
                        {profileGoals.map((goal, idx) => (
                          <div
                            key={goal.id || idx}
                            className="flex items-center gap-3 p-3 bg-white rounded-xl border border-zinc-200 hover:border-zinc-300 transition-colors"
                          >
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-purple-50 text-purple-600">
                              <Target className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-zinc-900">{goal.goalType || 'Unknown Goal'}</p>
                              {goal.targetAmount != null && (
                                <p className="text-[10px] text-zinc-400 font-mono mt-0.5">
                                  Target: {goal.targetAmount.toLocaleString()}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  </>
                )}

                {!profileLoading && !profileData && (
                  <p className="text-sm text-zinc-400 text-center py-12">No profile data available.</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
