const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Refresh mutex: concurrent 401s share one refresh call
let refreshPromise: Promise<boolean> | null = null;

async function refreshToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then((r) => r.ok)
    .finally(() => {
      refreshPromise = null;
    });
  return refreshPromise;
}

async function apiFetch(
  path: string,
  options?: RequestInit,
  retried = false,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  });

  if (res.status === 401 && !retried) {
    const ok = await refreshToken();
    if (ok) return apiFetch(path, options, true);
    // Don't redirect here — let auth context handle it
    throw new Error('Unauthorized');
  }

  return res;
}

export const api = {
  get: (path: string) => apiFetch(path),
  put: (path: string, body: unknown) =>
    apiFetch(path, { method: 'PUT', body: JSON.stringify(body) }),
  post: (path: string, body?: unknown) =>
    apiFetch(path, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
    }),
};
