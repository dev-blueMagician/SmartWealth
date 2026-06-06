import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Plus, RefreshCw } from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  wealthApi,
  type ClientDiscoveryAsset,
  type ClientDiscoveryGoal,
  type WorkflowCreateClientOption,
} from '../../services/wealthApi';
import { getAccessToken } from '../../auth/session';
import { getMobileClientId, setMobileClientId } from '../../lib/mobileClientSession';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';

const ASSET_TYPES = ['CASH', 'EQUITY', 'BOND', 'PROPERTY', 'OTHER'] as const;
const GOAL_TYPES = ['RETIREMENT', 'EDUCATION', 'HOME_PURCHASE', 'LEGACY', 'OTHER'] as const;

function formatMoney(n: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

export function MobileWealthGoalsAssetsPage() {
  const [clientOptions, setClientOptions] = useState<WorkflowCreateClientOption[]>([]);
  const [selectedClientId, setSelectedClientId] = useState(() => getMobileClientId() ?? '');
  const [manualClientIdInput, setManualClientIdInput] = useState('');
  const [assets, setAssets] = useState<ClientDiscoveryAsset[]>([]);
  const [goals, setGoals] = useState<ClientDiscoveryGoal[]>([]);
  const [loadingClients, setLoadingClients] = useState(true);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newAssetType, setNewAssetType] = useState<string>('CASH');
  const [newAssetValue, setNewAssetValue] = useState('');
  const [newGoalType, setNewGoalType] = useState<string>('RETIREMENT');
  const [newGoalAmount, setNewGoalAmount] = useState('');
  const [submittingAsset, setSubmittingAsset] = useState(false);
  const [submittingGoal, setSubmittingGoal] = useState(false);

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
    wealthApi
      .listResolvedClients()
      .then((clients) => {
        if (!mounted) return;
        setClientOptions(clients);
        if (clients.length > 0) {
          setSelectedClientId((prev) => {
            const p = prev.trim();
            if (p && clients.some((c) => c.clientId === p)) return p;
            if (saved && clients.some((c) => c.clientId === saved)) return saved;
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

  const applyManualClientId = () => {
    const id = manualClientIdInput.trim();
    if (!id) return;
    setMobileClientId(id);
    setSelectedClientId(id);
    setClientOptions([{ clientId: id, clientName: 'Client (saved)' }]);
    setManualClientIdInput('');
    setSuccessMessage('Client ID saved on this device.');
    setError(null);
  };

  const refreshLists = useCallback(async () => {
    if (!selectedClientId) {
      setAssets([]);
      setGoals([]);
      return;
    }
    setLoadingData(true);
    setError(null);
    try {
      const [a, g] = await Promise.all([
        wealthApi.listAssets(selectedClientId),
        wealthApi.listGoals(selectedClientId),
      ]);
      setAssets(a);
      setGoals(g);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoadingData(false);
    }
  }, [selectedClientId]);

  useEffect(() => {
    void refreshLists();
  }, [refreshLists]);

  const totalAssets = assets.reduce((sum, row) => sum + (Number(row.value) || 0), 0);

  const handleAddAsset = async () => {
    if (!selectedClientId) {
      setError(toApiError(new Error('Select a client first.')));
      return;
    }
    const value = Number(newAssetValue);
    if (!Number.isFinite(value) || value <= 0) {
      setError(toApiError(new Error('Asset value must be a positive number.')));
      return;
    }
    setSubmittingAsset(true);
    try {
      await wealthApi.createAsset(selectedClientId, { assetType: newAssetType, value });
      setSuccessMessage('Asset added.');
      setNewAssetValue('');
      await refreshLists();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmittingAsset(false);
    }
  };

  const handleAddGoal = async () => {
    if (!selectedClientId) {
      setError(toApiError(new Error('Select a client first.')));
      return;
    }
    const targetAmount = Number(newGoalAmount);
    if (!Number.isFinite(targetAmount) || targetAmount <= 0) {
      setError(toApiError(new Error('Goal target must be a positive number.')));
      return;
    }
    setSubmittingGoal(true);
    try {
      await wealthApi.createGoal(selectedClientId, { goalType: newGoalType, targetAmount });
      setSuccessMessage('Goal added.');
      setNewGoalAmount('');
      await refreshLists();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setSubmittingGoal(false);
    }
  };

  return (
    <motion.div
      key="mobile-wealth"
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -16 }}
      className="space-y-6 pb-6"
    >
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <div className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-white p-5 shadow-sm">
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Declared holdings</p>
        <p className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">${formatMoney(totalAssets)}</p>
        <p className="mt-1 text-xs text-zinc-500">
          {loadingData ? 'Refreshing…' : `${assets.length} asset(s) · ${goals.length} goal(s)`}
        </p>
      </div>

      {!loadingClients && clientOptions.length === 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/90 p-4 space-y-3">
          <p className="text-xs text-amber-900 font-medium leading-relaxed">
            Client mode does not call staff-only APIs. Paste the <span className="font-mono">clientId</span> from your RM /
            onboarding flow (or sign in on Professional Portal once to load the list automatically).
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Client UUID"
              value={manualClientIdInput}
              onChange={(e) => setManualClientIdInput(e.target.value)}
              className="flex-1 px-3 py-2.5 rounded-xl border border-amber-200 bg-white text-xs font-mono outline-none"
            />
            <button
              type="button"
              onClick={() => applyManualClientId()}
              className="px-4 py-2.5 rounded-xl bg-amber-700 text-white text-xs font-bold shrink-0 hover:bg-amber-600"
            >
              Save
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 ml-1">Client</label>
        <div className="flex gap-2">
          <select
            value={selectedClientId}
            onChange={(e) => setSelectedClientId(e.target.value)}
            disabled={loadingClients || clientOptions.length === 0}
            className="flex-1 px-4 py-3 rounded-2xl border border-zinc-200 bg-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
          >
            {clientOptions.length === 0 && <option value="">Set client ID above or open Home after staff login</option>}
            {clientOptions.map((item) => (
              <option key={item.clientId} value={item.clientId}>
                {item.clientName ?? item.clientId}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void refreshLists()}
            disabled={loadingData || !selectedClientId}
            className="px-3 rounded-2xl border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 disabled:opacity-40"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-5 h-5', loadingData && 'animate-spin')} />
          </button>
        </div>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Assets</h3>
        <div className="space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
          {assets.length === 0 && !loadingData && (
            <p className="text-xs text-zinc-500">No assets yet. Add one below or use onboarding.</p>
          )}
          {assets.map((row) => (
            <div
              key={row.id ?? `${row.assetType}-${row.value}`}
              className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0"
            >
              <span className="text-sm font-medium text-zinc-800">{row.assetType}</span>
              <span className="text-sm font-mono text-zinc-600">${formatMoney(Number(row.value) || 0)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={newAssetType}
            onChange={(e) => setNewAssetType(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-zinc-200 bg-white text-sm"
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Value"
            value={newAssetValue}
            onChange={(e) => setNewAssetValue(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-zinc-200 bg-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAddAsset()}
          disabled={submittingAsset || !selectedClientId}
          className="w-full py-3 rounded-2xl bg-indigo-600 text-white text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-500 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {submittingAsset ? 'Saving…' : 'Add asset'}
        </button>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-tight">Goals</h3>
        <div className="space-y-2 rounded-2xl border border-zinc-100 bg-zinc-50/50 p-4">
          {goals.length === 0 && !loadingData && (
            <p className="text-xs text-zinc-500">No goals yet. Add a target below or use onboarding.</p>
          )}
          {goals.map((row) => (
            <div
              key={row.id ?? `${row.goalType}-${row.targetAmount}`}
              className="flex justify-between items-center py-2 border-b border-zinc-100 last:border-0"
            >
              <span className="text-sm font-medium text-zinc-800">{row.goalType}</span>
              <span className="text-sm font-mono text-zinc-600">${formatMoney(Number(row.targetAmount) || 0)}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select
            value={newGoalType}
            onChange={(e) => setNewGoalType(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-zinc-200 bg-white text-sm"
          >
            {GOAL_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Target amount"
            value={newGoalAmount}
            onChange={(e) => setNewGoalAmount(e.target.value)}
            className="px-4 py-3 rounded-2xl border border-zinc-200 bg-white text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void handleAddGoal()}
          disabled={submittingGoal || !selectedClientId}
          className="w-full py-3 rounded-2xl border-2 border-indigo-600 text-indigo-600 text-sm font-bold flex items-center justify-center gap-2 hover:bg-indigo-50 disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {submittingGoal ? 'Saving…' : 'Add goal'}
        </button>
      </section>
    </motion.div>
  );
}
