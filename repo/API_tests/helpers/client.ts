/**
 * Lightweight HTTP client for API tests.
 * Uses the native fetch API (Node 20+).
 */

export const BASE_URL =
  (process.env.TEST_BASE_URL ?? "http://localhost:3011").replace(/\/$/, "");

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export interface ApiResponse<T = Record<string, unknown>> {
  status: number;
  body: T;
  headers: Headers;
}

async function request<T>(
  method: Method,
  path: string,
  options: {
    body?: unknown;
    token?: string;
    query?: Record<string, string | number | boolean | undefined>;
  } = {}
): Promise<ApiResponse<T>> {
  const url = new URL(`${BASE_URL}/api/v1${path}`);

  if (options.query) {
    for (const [k, v] of Object.entries(options.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (options.token) {
    headers["Authorization"] = `Bearer ${options.token}`;
  }

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  let body: T;
  try {
    body = (await res.json()) as T;
  } catch {
    body = null as unknown as T;
  }

  return { status: res.status, body, headers: res.headers };
}

export const api = {
  get<T = Record<string, unknown>>(
    path: string,
    token?: string,
    query?: Record<string, string | number | boolean | undefined>
  ): Promise<ApiResponse<T>> {
    return request<T>("GET", path, { token, query });
  },

  post<T = Record<string, unknown>>(
    path: string,
    body?: unknown,
    token?: string
  ): Promise<ApiResponse<T>> {
    return request<T>("POST", path, { body, token });
  },

  patch<T = Record<string, unknown>>(
    path: string,
    body?: unknown,
    token?: string
  ): Promise<ApiResponse<T>> {
    return request<T>("PATCH", path, { body, token });
  },

  del<T = Record<string, unknown>>(
    path: string,
    token?: string
  ): Promise<ApiResponse<T>> {
    return request<T>("DELETE", path, { token });
  },
};

export async function loginAs(
  orgSlug: string,
  username: string,
  password: string
): Promise<string> {
  const res = await api.post<{ token: string }>("/auth/login", {
    organizationSlug: orgSlug,
    username,
    password,
  });

  if (res.status !== 200 || !res.body.token) {
    throw new Error(
      `loginAs(${username}) failed — HTTP ${res.status}: ${JSON.stringify(res.body)}`
    );
  }

  return res.body.token;
}
