/**
 * Tiny typed fetch wrapper for client components.
 * Unwraps the { success, data, error } envelope produced by lib/api.ts.
 */

type Envelope<T> = {
  success: boolean;
  data?: T;
  error?: string;
  issues?: { path: string; message: string }[];
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; issues?: { path: string; message: string }[] };

async function request<T>(url: string, init?: RequestInit): Promise<ApiResult<T>> {
  try {
    // FormData must set its own multipart boundary — forcing a JSON
    // Content-Type (or an empty one) produces a body the server cannot parse.
    const isForm = init?.body instanceof FormData;
    const res = await fetch(url, {
      ...init,
      headers: isForm
        ? init?.headers
        : { "Content-Type": "application/json", ...(init?.headers || {}) },
    });
    const json = (await res.json().catch(() => ({}))) as Envelope<T>;
    if (!res.ok || !json.success) {
      return {
        ok: false,
        status: res.status,
        error: json.error || `Request failed (${res.status})`,
        issues: json.issues,
      };
    }
    return { ok: true, data: json.data as T };
  } catch (e) {
    return { ok: false, status: 0, error: (e as Error).message || "Network error" };
  }
}

export const api = {
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "POST", body: JSON.stringify(body ?? {}) }),
  put: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PUT", body: JSON.stringify(body ?? {}) }),
  patch: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "PATCH", body: JSON.stringify(body ?? {}) }),
  del: <T>(url: string, body?: unknown) =>
    request<T>(url, { method: "DELETE", body: body ? JSON.stringify(body) : undefined }),
  /** Multipart POST for file uploads (see the FormData note in `request`). */
  upload: <T>(url: string, form: FormData) => request<T>(url, { method: "POST", body: form }),
};
