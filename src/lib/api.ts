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
