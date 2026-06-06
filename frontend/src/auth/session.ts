/**
 * Portal-only auth (staff). Client mobile flows remain unauthenticated against wealth APIs per demo.
 */

const AUTH_KEY = 'smartwealth_portal_auth';

export type PortalAuth = {
  accessToken: string;
  username: string;
  userId: string;
  roles: string[];
};

export function loadPortalAuth(): PortalAuth | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalAuth;
    if (!parsed?.accessToken || !parsed.username || !Array.isArray(parsed.roles)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function savePortalAuth(auth: PortalAuth): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
}

export function clearPortalAuth(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function getAccessToken(): string | null {
  return loadPortalAuth()?.accessToken ?? null;
}
