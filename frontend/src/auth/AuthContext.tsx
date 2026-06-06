/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { wealthApi } from '../services/wealthApi';
import { clearPortalAuth, loadPortalAuth, savePortalAuth, type PortalAuth } from './session';
import { buildPortalCapabilities, defaultPortalCapabilities, type PortalCapabilities } from './portalPermissions';

type AuthContextValue = {
  auth: PortalAuth | null;
  bootstrapping: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasAnyRole: (...roles: string[]) => boolean;
  portalCaps: PortalCapabilities;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<PortalAuth | null>(() => loadPortalAuth());
  const [bootstrapping, setBootstrapping] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function validateSession() {
      const stored = loadPortalAuth();
      if (!stored?.accessToken) {
        setBootstrapping(false);
        return;
      }
      try {
        const me = await wealthApi.fetchMe();
        if (cancelled) return;
        const next: PortalAuth = {
          accessToken: stored.accessToken,
          username: me.username,
          userId: String(me.userId),
          roles: me.roles,
        };
        savePortalAuth(next);
        setAuth(next);
      } catch {
        clearPortalAuth();
        if (!cancelled) setAuth(null);
      } finally {
        if (!cancelled) setBootstrapping(false);
      }
    }
    void validateSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    clearPortalAuth();
    const res = await wealthApi.login(username, password);
    const portal: PortalAuth = {
      accessToken: res.accessToken,
      username: res.username,
      userId: String(res.userId),
      roles: res.roles,
    };
    savePortalAuth(portal);
    setAuth(portal);
  }, []);

  const logout = useCallback(() => {
    clearPortalAuth();
    setAuth(null);
  }, []);

  const hasAnyRole = useCallback(
    (...roles: string[]) => {
      if (!auth) return false;
      const upper = roles.map((r) => r.toUpperCase());
      return auth.roles.some((r) => upper.includes(r.toUpperCase()));
    },
    [auth],
  );

  const portalCaps = useMemo(
    () => (auth?.roles ? buildPortalCapabilities(auth.roles) : defaultPortalCapabilities()),
    [auth?.roles],
  );

  const value = useMemo(
    () => ({
      auth,
      bootstrapping,
      login,
      logout,
      hasAnyRole,
      portalCaps,
    }),
    [auth, bootstrapping, login, logout, hasAnyRole, portalCaps],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
