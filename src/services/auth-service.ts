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

/** Logout — clear app JWT cookies, then redirect to WP to destroy WP session */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
  // Redirect to WP logout endpoint which destroys WP session then goes to maf.run homepage
  const wpBase = import.meta.env.VITE_WP_URL || 'https://maf.run';
  window.location.href = `${wpBase}/?maf_sso_logout=${encodeURIComponent(wpBase)}`;
}
