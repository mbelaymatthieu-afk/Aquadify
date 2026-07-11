// Talks to the EXISTING drip-track1 (Aquadify) FastAPI backend.
// Base URL resolved from src/config (env in dev, app.json `extra` in builds).

import { AQUADIFY_API } from "@/src/config";

const BASE = AQUADIFY_API;

type Method = "GET" | "POST" | "PUT" | "DELETE";

async function request<T = any>(
  path: string,
  opts: { method?: Method; body?: any; token?: string | null } = {},
): Promise<T> {
  const { method = "GET", body, token } = opts;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const detail = data?.detail;
    const msg =
      typeof detail === "string"
        ? detail
        : Array.isArray(detail)
          ? detail.map((d: any) => d.msg).join(", ")
          : `Error ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T = any>(p: string, token?: string | null) => request<T>(p, { token }),
  post: <T = any>(p: string, body?: any, token?: string | null) =>
    request<T>(p, { method: "POST", body, token }),
  put: <T = any>(p: string, body?: any, token?: string | null) =>
    request<T>(p, { method: "PUT", body, token }),
  del: <T = any>(p: string, token?: string | null) =>
    request<T>(p, { method: "DELETE", token }),
};

export const API_BASE = BASE;
