/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/AuthContext';
import { wealthApi, type AdminClientOption, type PortalUserSummary } from '../../services/wealthApi';
import { toApiError, type ApiError } from '../../services/apiError';
import { ErrorPopup } from '../../components/ErrorPopup';
import { SuccessToast } from '../../components/SuccessToast';
import { cn } from '../../lib/utils';
import { Plus, Shield, X } from 'lucide-react';
import { useT } from '../../i18n';

const ROLE_OPTIONS = ['RM', 'WM', 'IM', 'ADMIN', 'CLIENT'] as const;

export function UserManagementPage() {
  const { portalCaps } = useAuth();
  const canAdmin = portalCaps.canManagePortalUsers;
  const t = useT();

  const [users, setUsers] = useState<PortalUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiError | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRoles, setNewRoles] = useState<string[]>(['RM']);
  const [newClientId, setNewClientId] = useState('');
  const [clientOptions, setClientOptions] = useState<AdminClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const resetCreateForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewEmail('');
    setNewRoles(['RM']);
    setNewClientId('');
  };

  const openCreateModal = () => {
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const closeCreateModal = () => {
    if (creating) return;
    setCreateModalOpen(false);
    resetCreateForm();
  };

  const loadClientOptions = useCallback(async () => {
    if (!canAdmin) return;
    setClientsLoading(true);
    try {
      const rows = await wealthApi.listAdminClients();
      setClientOptions(rows);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setClientsLoading(false);
    }
  }, [canAdmin]);

  const load = useCallback(async () => {
    if (!canAdmin) return;
    setLoading(true);
    try {
      const rows = await wealthApi.listPortalUsers();
      setUsers(rows);
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setLoading(false);
    }
  }, [canAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadClientOptions();
  }, [loadClientOptions]);

  useEffect(() => {
    if (!createModalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !creating) closeCreateModal();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [createModalOpen, creating]);

  const toggleRole = (code: string) => {
    setNewRoles((prev) => {
      const next = prev.includes(code) ? prev.filter((r) => r !== code) : [...prev, code];
      if (!next.includes('CLIENT')) {
        setNewClientId('');
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!newUsername.trim() || !newPassword) {
      setError(toApiError(new Error(t.userManagement.errUsernamePassword)));
      return;
    }
    if (newRoles.length === 0) {
      setError(toApiError(new Error(t.userManagement.errSelectRole)));
      return;
    }
    if (newRoles.includes('CLIENT') && !newClientId.trim()) {
      setError(toApiError(new Error(t.userManagement.errSelectClient)));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await wealthApi.createPortalUser({
        username: newUsername.trim(),
        password: newPassword,
        email: newEmail.trim() || undefined,
        roles: newRoles,
        clientId: newRoles.includes('CLIENT') && newClientId.trim() ? newClientId.trim() : undefined,
      });
      setSuccessMessage(t.userManagement.createdToast);
      setCreateModalOpen(false);
      resetCreateForm();
      await load();
    } catch (err) {
      setError(toApiError(err));
    } finally {
      setCreating(false);
    }
  };

  const toggleEnabled = async (user: PortalUserSummary) => {
    try {
      await wealthApi.patchPortalUser(user.id, { enabled: !user.enabled });
      setSuccessMessage(t.userManagement.updatedToast.replace('{username}', user.username));
      await load();
    } catch (err) {
      setError(toApiError(err));
    }
  };

  if (!canAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center text-amber-900">
        <Shield className="w-10 h-10 mx-auto mb-3 opacity-70" />
        <p className="font-semibold">{t.userManagement.adminRequired}</p>
        <p className="text-sm mt-2 text-amber-800/90">{t.userManagement.adminRequiredDesc}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <ErrorPopup error={error} onClose={() => setError(null)} />
      <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-zinc-900 tracking-tight">{t.userManagement.title}</h2>
          <p className="text-sm text-zinc-500 mt-1">
            {t.userManagement.subtitle}
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {t.userManagement.createUser}
        </button>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-100 flex items-center justify-between">
          <h3 className="font-serif italic text-lg text-zinc-900">{t.userManagement.accounts}</h3>
          <button
            type="button"
            onClick={() => {
              void load();
              void loadClientOptions();
            }}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800"
          >
            Refresh
          </button>
        </div>
        {loading && <div className="px-6 py-10 text-sm text-zinc-500">{t.userManagement.loading}</div>}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-zinc-50 text-left text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  <th className="px-6 py-3">{t.userManagement.colUser}</th>
                  <th className="px-6 py-3">{t.userManagement.colRoles}</th>
                  <th className="px-6 py-3">Client</th>
                  <th className="px-6 py-3 text-right">{t.userManagement.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/80">
                    <td className="px-6 py-4">
                      <p className="font-bold text-zinc-900">{u.username}</p>
                      <p className="text-[10px] font-mono text-zinc-400">{u.id}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs text-zinc-700">{u.roles.join(', ')}</span>
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-600">{u.clientId ?? '—'}</td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        onClick={() => void toggleEnabled(u)}
                        className={cn(
                          'text-xs font-bold px-3 py-1 rounded-full border',
                          u.enabled
                            ? 'border-emerald-200 text-emerald-800 bg-emerald-50'
                            : 'border-zinc-200 text-zinc-500 bg-zinc-100',
                        )}
                      >
                        {u.enabled ? t.userManagement.active : t.userManagement.disabled}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {createModalOpen ? (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/35 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-user-modal-title"
          onClick={() => {
            if (!creating) closeCreateModal();
          }}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-zinc-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-zinc-100 shrink-0">
              <div>
                <h2 id="create-user-modal-title" className="text-lg font-bold text-zinc-900">
                  {t.userManagement.createUserTitle}
                </h2>
                <p className="text-xs text-zinc-500 mt-0.5">{t.userManagement.createUserDesc}</p>
              </div>
              <button
                type="button"
                onClick={closeCreateModal}
                disabled={creating}
                className="p-2 rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
                aria-label={t.common.close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleCreate();
              }}
              className="flex flex-col min-h-0 flex-1"
            >
              <div className="overflow-y-auto px-5 py-4 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <label className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.userManagement.username}</span>
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      required
                      autoFocus
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 text-sm"
                    />
                  </label>
                  <label className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.userManagement.password}</span>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 text-sm"
                    />
                  </label>
                  <label className="space-y-1 block sm:col-span-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.userManagement.emailOptional}</span>
                    <input
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 text-sm"
                    />
                  </label>
                </div>
                <div className="space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.userManagement.roles}</span>
                  <div className="flex flex-wrap gap-2">
                    {ROLE_OPTIONS.map((code) => (
                      <button
                        key={code}
                        type="button"
                        onClick={() => toggleRole(code)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors',
                          newRoles.includes(code)
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-50 text-zinc-600 border-zinc-200 hover:border-zinc-400',
                        )}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    CLIENT is for mobile-linked accounts — pick the wealth client row to attach.
                  </p>
                </div>
                {newRoles.includes('CLIENT') && (
                  <label className="space-y-1 block">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{t.userManagement.wealthClient}</span>
                    <select
                      value={newClientId}
                      onChange={(e) => setNewClientId(e.target.value)}
                      disabled={creating || clientsLoading}
                      className="w-full px-4 py-2 rounded-xl border border-zinc-200 text-sm bg-white"
                    >
                      <option value="">{clientsLoading ? 'Loading clients…' : 'Select a client…'}</option>
                      {clientOptions.map((c) => {
                        const labelName = (c.name && c.name.trim()) || 'Unnamed';
                        const st = c.status ?? '—';
                        return (
                          <option key={c.id} value={c.id}>
                            {labelName} · {st} · {c.id}
                          </option>
                        );
                      })}
                    </select>
                    {!clientsLoading && clientOptions.length === 0 && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        No clients yet — create a case in RM flow first, then refresh this page.
                      </p>
                    )}
                  </label>
                )}
              </div>

              <div className="flex flex-wrap gap-2 px-5 py-4 border-t border-zinc-100 shrink-0 bg-zinc-50/80 rounded-b-2xl">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 disabled:opacity-50"
                >
                  {creating ? t.userManagement.creating : t.userManagement.createUser}
                </button>
                <button
                  type="button"
                  onClick={closeCreateModal}
                  disabled={creating}
                  className="px-4 py-2 border border-zinc-200 rounded-xl text-sm font-bold bg-white disabled:opacity-50"
                >
                  {t.userManagement.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
