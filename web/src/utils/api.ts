// web/src/utils/api.ts

export async function postJSON<T>(url: string, body: unknown): Promise<T> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    const payload = await resp.json().catch(() => ({}));
    throw new Error((payload as any)?.error || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}

export async function postForm<T>(url: string, form: FormData): Promise<T> {
  const resp = await fetch(url, { method: 'POST', body: form });
  if (!resp.ok) {
    const payload = await resp.json().catch(() => ({}));
    throw new Error((payload as any)?.error || `HTTP ${resp.status}`);
  }
  return resp.json() as Promise<T>;
}
