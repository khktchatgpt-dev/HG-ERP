/**
 * Tiny client-side fetch wrapper for /api/* routes.
 *
 *   const user = await api('/api/users', { method: 'POST', body: { email, password } })
 *
 * - JSON in / JSON out (Content-Type set automatically)
 * - Throws ApiError on non-2xx so callers can `try/catch`
 * - 401 → redirects to /login (cookie expired/invalid)
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public issues?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Thông báo lỗi thân thiện cho toast: ưu tiên các lỗi validation cụ thể (zod
 * `issues`) để user biết CHÍNH XÁC field nào sai, thay vì câu chung "Validation
 * failed". Không phải ApiError → trả `fallback`.
 */
export function apiErrorText(e: unknown, fallback = 'Có lỗi, thử lại'): string {
  if (e instanceof ApiError) {
    const issues = Array.isArray(e.issues) ? e.issues : []
    const msgs = issues
      .map((i) =>
        i && typeof i === 'object' && 'message' in i
          ? String((i as { message: unknown }).message)
          : '',
      )
      .filter(Boolean)
    if (msgs.length) return [...new Set(msgs)].join(' · ')
    return e.message || fallback
  }
  return fallback
}

type ApiInit = Omit<RequestInit, 'body'> & {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Don't redirect to /login on 401. Default: false (i.e. do redirect). */
  noAuthRedirect?: boolean
}

export async function api<T = unknown>(path: string, init: ApiInit = {}): Promise<T> {
  const { body, headers, noAuthRedirect, ...rest } = init
  const hasBody = body !== undefined && body !== null
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(hasBody ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    body: hasBody ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && !noAuthRedirect && typeof window !== 'undefined') {
    window.location.href = '/login'
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    const payload = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      payload.error ?? `Request failed (${res.status})`,
      payload.code,
      payload.issues,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json()
}
