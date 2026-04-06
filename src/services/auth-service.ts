import { api } from './api-client';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
}

/** Login with WordPress credentials */
export async function login(username: string, password: string): Promise<boolean> {
  try {
    const res = await api.post('/auth/login', { username, password });
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

/** Logout — clear cookies server-side */
export async function logout(): Promise<void> {
  await api.post('/auth/logout');
}
