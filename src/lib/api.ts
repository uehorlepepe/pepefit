export const TOKEN_KEY = 'pepefit.token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Options = {
  method?: string;
  body?: unknown;
  form?: FormData;
  signal?: AbortSignal;
};

export async function api<T = any>(path: string, options: Options = {}): Promise<T> {
  const headers: Record<string, string> = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method: options.method || 'GET', headers, body, signal: options.signal });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json().catch(() => null) : null;
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('pepefit:unauthorized'));
    }
    throw new ApiError(data?.error || 'Something went wrong. Please try again.', res.status);
  }
  return data as T;
}

export const authApi = {
  me: () => api<{ user: import('../types').User }>('/auth/me'),
  login: (email: string, password: string) => api<{ token: string; user: import('../types').User }>('/auth/login', { method: 'POST', body: { email, password } }),
  signup: (name: string, email: string, password: string) => api<{ token: string; user: import('../types').User }>('/auth/signup', { method: 'POST', body: { name, email, password } }),
  forgot: (email: string) => api<{ message: string; devResetUrl?: string; devNote?: string }>('/auth/forgot-password', { method: 'POST', body: { email } }),
  reset: (token: string, password: string) => api<{ message: string }>('/auth/reset-password', { method: 'POST', body: { token, password } }),
  updateAccount: (body: unknown) => api<{ user: import('../types').User; message: string }>('/auth/account', { method: 'PATCH', body }),
};