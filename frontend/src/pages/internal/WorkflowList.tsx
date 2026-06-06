import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Workflow, ChevronRight } from 'lucide-react';
import { type WorkflowCacheItem } from '../../services/workflowApi';
import { wealthApi, type WorkflowCreateClientOption } from '../../services/wealthApi';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';
import { cn } from '../../lib/utils';

export const WorkflowListPage = () => {
  const [items, setItems] = useState<WorkflowCacheItem[]>([]);
  const [query, setQuery] = useState('');
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [clientOptions, setClientOptions] = useState<WorkflowCreateClientOption[]>([]);
  const [clientId, setClientId] = useState('');
  const [clientName, setClientName] = useState('');

  const filteredItems = useMemo(() => {
    if (!query.trim()) return items;
    const keyword = query.toLowerCase();
    return items.filter((item) => {
      const hay = [
        item.id,
        item.status ?? '',
        item.caseId ?? '',
        item.caseType ?? '',
        item.clientId ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(keyword);
    });
  }, [items, query]);

  const loadCreateOptions = async () => {
    setLoadingOptions(true);
    try {
      const options = await wealthApi.listWorkflowCreateOptions();
      let nextCases = options.cases;
      let nextClients = options.clients;

      if (nextCases.length === 0) {
        const fallbackCases = await wealthApi.listCases();
        nextCases = fallbackCases
          .filter((item) => (item.id || item.caseId) && item.clientId)
          .map((item) => ({
            caseId: item.id || item.caseId || '',
            clientId: item.clientId || '',
            caseName: item.type || 'Service Case',
            clientName: item.clientName,
            type: item.type,
            status: item.status,
            createdAt: item.createdAt,
          }));
      }

      if (nextClients.length === 0) {
        const clientMap = new Map<string, WorkflowCreateClientOption>();
        nextCases.forEach((item) => {
          if (!item.clientId) return;
          clientMap.set(item.clientId, {
            clientId: item.clientId,
            clientName: item.clientName,
          });
        });
        nextClients = Array.from(clientMap.values());
      }

      setClientOptions(nextClients);

      if (!clientId && nextClients.length > 0) {
        const selectedClient = nextClients[0];
        setClientId(selectedClient.clientId);
        setClientName(selectedClient.clientName ?? '');
      }
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoadingOptions(false);
    }
  };

  useEffect(() => {
    void loadCreateOptions();
  }, []);

  const handleClientChanged = (nextClientId: string) => {
    setClientId(nextClientId);
    const selectedClient = clientOptions.find((item) => item.clientId === nextClientId);
    if (selectedClient) {
      setClientName(selectedClient.clientName ?? '');
    }
  };

  const fetchWorkflowsForClient = useCallback(async (cid: string) => {
    setLoadingRefresh(true);
    try {
      const rows = await wealthApi.listWorkflowLinksByClient(cid);
      setItems(
        rows.map((r) => ({
          id: r.workflowId,
          status: r.caseStatus,
          clientId: r.clientId,
          caseId: r.caseId,
          caseType: r.caseType,
        })),
      );
    } catch (err) {
      setError(toApiError(err));
      setItems([]);
    } finally {
      setLoadingRefresh(false);
    }
  }, []);

  useEffect(() => {
    if (!clientId) {
      setItems([]);
      return;
    }
    void fetchWorkflowsForClient(clientId);
  }, [clientId, fetchWorkflowsForClient]);

  const handleRefresh = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!clientId) {
      setSuccessMessage(null);
      setError(toApiError(new Error('Select a client first.')));
      return;
    }
    await fetchWorkflowsForClient(clientId);
    setSuccessMessage('Workflow list refreshed.');
  };

  return (
    <div className="space-y-8">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div className="flex justify-between items-end flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-serif italic text-zinc-900">Workflow Control Tower</h1>
          <p className="text-zinc-500 text-sm mt-1">
            Workflows are created on the AI-engine when an RM creates a case (<code className="text-xs">POST /api/cases</code>). Pick a
            client to see linked workflows from the database.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => void loadCreateOptions()}
            disabled={loadingOptions}
            className={cn(
              'px-5 py-3 bg-white border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-700 flex items-center gap-2 transition-all',
              loadingOptions ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-50',
            )}
          >
            <RefreshCw className={cn('w-4 h-4', loadingOptions && 'animate-spin')} />
            Reload clients
          </button>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            disabled={loadingRefresh || !clientId}
            className={cn(
              'px-5 py-3 bg-white border border-zinc-200 rounded-2xl text-xs font-bold text-zinc-700 flex items-center gap-2 transition-all',
              loadingRefresh || !clientId ? 'opacity-60 cursor-not-allowed' : 'hover:bg-zinc-50',
            )}
          >
            <RefreshCw className={cn('w-4 h-4', loadingRefresh && 'animate-spin')} />
            Refresh list
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <section className="xl:col-span-2 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50 space-y-3">
            <label className="block space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Client</span>
              <select
                value={clientId}
                onChange={(e) => handleClientChanged(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 bg-white"
              >
                {clientOptions.length === 0 && <option value="">No clients</option>}
                {clientOptions.map((item) => (
                  <option key={item.clientId} value={item.clientId}>
                    {item.clientName ?? 'Unknown Client'}
                  </option>
                ))}
              </select>
            </label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by workflow ID, case id, status, type..."
              className="w-full px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 outline-none"
            />
          </div>
          <div className="divide-y divide-zinc-100">
            {filteredItems.length === 0 ? (
              <div className="px-8 py-20 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-zinc-50 border border-zinc-100 flex items-center justify-center">
                  <Workflow className="w-7 h-7 text-zinc-300" />
                </div>
                <p className="mt-4 text-zinc-400 text-sm">
                  No workflows for this client yet. Create a case via RM Entry — a workflow is provisioned on the AI-engine first, then the
                  case is stored with <span className="font-semibold">ONBOARDING</span>.
                </p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <Link
                  key={item.id}
                  to={`/internal/ai-engine/workflows/${item.id}${item.caseId ? `?caseId=${encodeURIComponent(item.caseId)}` : ''}`}
                  className="px-6 py-4 flex items-center justify-between hover:bg-zinc-50 transition-colors group"
                >
                  <div>
                    <p className="font-mono text-xs font-bold text-zinc-900">{item.id}</p>
                    <p className="text-[11px] text-zinc-500 mt-1">
                      Case: <span className="font-mono">{item.caseId ?? '—'}</span> · Type:{' '}
                      <span className="font-semibold">{item.caseType ?? '—'}</span> · Status:{' '}
                      <span className="font-semibold">{item.status ?? 'UNKNOWN'}</span>
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-1 text-zinc-400 group-hover:text-blue-600 transition-colors">
                    <span className="text-[10px] font-bold uppercase tracking-widest">Manage</span>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </Link>
              ))
            )}
          </div>
        </section>

        <aside className="bg-white rounded-3xl border border-zinc-200 shadow-sm p-6 space-y-4">
          <h2 className="text-lg font-serif italic text-zinc-900">RM case defaults</h2>
          <p className="text-xs text-zinc-500">
            New cases from <code className="text-[10px]">POST /api/cases</code> use type{' '}
            <span className="font-semibold text-zinc-800">ONBOARDING</span>. The backend creates an AI-engine workflow first (with retries),
            then persists the case with <code className="text-[10px]">workflow_id</code>.
          </p>
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Auto-selected case type</span>
            <input
              value="ONBOARDING"
              readOnly
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-700 font-semibold"
            />
          </label>
          <label className="block space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Selected client</span>
            <input
              value={clientName}
              readOnly
              placeholder="—"
              className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm text-zinc-600"
            />
          </label>
        </aside>
      </div>
    </div>
  );
};
