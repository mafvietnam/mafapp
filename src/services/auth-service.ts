import { api } from './api-client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string; // 'USER' | 'COACH' | 'ADMIN'
}

/** Exchange WordPress SSO one-time code for JWT session */
export async function loginWithSsoCode(code: string): Promise<boolean> {
  try {
    const res = await api.post('/auth/wp-sso', { code });
    return res.ok;
  } catch {
    return false;
  }
}

/** Fetch current authenticated user */
export async function getMe(): Promise<AuthUser | null> {
  try {
    const res = await api.get('/users/me');
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Logout — clear app JWT cookies and redirect to WP to destroy WP session.
 * Two modes:
 * - fullLogout=true (default): clears both app JWT + WP session (user must re-login everywhere)
 * - fullLogout=false: clears only app JWT (WP session preserved for SSO re-login)
 */
export async function logout(fullLogout = true): Promise<void> {
  await api.post('/auth/logout');
  if (fullLogout) {
    // Full logout: destroy WP session too so user can't auto-re-login via SSO
    const wpBase = import.meta.env.VITE_WP_URL || 'https://maf.run';
    window.location.href = `${wpBase}/?maf_sso_logout=${encodeURIComponent(wpBase)}`;
  }
}
