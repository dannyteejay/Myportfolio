// Central API client with automatic access-token refresh.

let accessToken: string | null = null;
const listeners = new Set<(t: string | null) => void>();

export function setAccessToken(token: string | null) {
  accessToken = token;
  listeners.forEach((l) => l(token));
}
export function getAccessToken() {
  return accessToken;
}
export function onTokenChange(cb: (t: string | null) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public issues?: unknown) {
    super(message);
  }
}

interface ReqOpts {
  method?: string;
  body?: unknown;
  auth?: boolean;
  isForm?: boolean;
  _retry?: boolean;
}

async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/refresh", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return false;
    const json = await res.json();
    setAccessToken(json.data.accessToken);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = unknown>(
  path: string,
  opts: ReqOpts = {}
): Promise<T> {
  const { method = "GET", body, auth = false, isForm = false } = opts;
  const headers: Record<string, string> = {};
  if (!isForm) headers["Content-Type"] = "application/json";
  if (auth && accessToken) headers["Authorization"] = `Bearer ${accessToken}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    credentials: "include",
    body: body ? (isForm ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  if (res.status === 401 && auth && !opts._retry) {
    const refreshed = await refreshToken();
    if (refreshed) return api<T>(path, { ...opts, _retry: true });
  }

  const text = await res.text();
  const json = text ? JSON.parse(text) : {};
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json?.error?.message || "Request failed",
      json?.error?.issues
    );
  }
  return json.data as T;
}

export { refreshToken };
