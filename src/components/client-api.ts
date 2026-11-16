"use client";

export async function api<T = unknown>(path: string, method = "GET", data?: unknown): Promise<T> {
  const res = await fetch(`/api/v1${path}`, {
    method,
    headers: data !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { error?: string }).error ?? `Erreur ${res.status}`);
  return json as T;
}
