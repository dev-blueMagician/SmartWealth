/**
 * Persists the demo client scope for Client Companion routes.
 * Staff-only APIs (/api/cases, /api/workflows/...) are not called without a portal JWT;
 * this id is used with permitAll discovery APIs (/clients/{id}/assets, etc.).
 */

const MOBILE_CLIENT_ID_KEY = 'smartwealth_mobile_client_id';

export function getMobileClientId(): string | null {
  try {
    const id = localStorage.getItem(MOBILE_CLIENT_ID_KEY)?.trim();
    return id || null;
  } catch {
    return null;
  }
}

export function setMobileClientId(clientId: string): void {
  const trimmed = clientId.trim();
  if (!trimmed) {
    localStorage.removeItem(MOBILE_CLIENT_ID_KEY);
    return;
  }
  localStorage.setItem(MOBILE_CLIENT_ID_KEY, trimmed);
}

export function clearMobileClientId(): void {
  try {
    localStorage.removeItem(MOBILE_CLIENT_ID_KEY);
  } catch {
    /* ignore */
  }
}
