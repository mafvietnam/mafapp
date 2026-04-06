import { api } from './api-client';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
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

/** Get login URL (redirects to backend which initiates WP OAuth) */
export function getLoginUrl(): string {
  return `${API_BASE}/auth/login`;
}

/** Logout — clear cookies server-side */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
