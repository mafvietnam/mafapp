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
  // For FormData (multipart uploads) the browser MUST set Content-Type itself (with the boundary) —
  // forcing application/json would make the server see zero files. Auth stays via the httpOnly
  // cookie (credentials:'include'), and the 401→refresh retry below still applies.
  const isForm = options?.body instanceof FormData;
  const baseHeaders = isForm ? {} : { 'Content-Type': 'application/json' };
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',
    headers: { ...baseHeaders, ...options?.headers },
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
  /** Multipart POST — pass a FormData; Content-Type/boundary set by the browser. */
  postForm: (path: string, form: FormData) =>
    apiFetch(path, { method: 'POST', body: form }),
  patch: (path: string, body: unknown) =>
    apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (path: string) => apiFetch(path, { method: 'DELETE' }),
};
