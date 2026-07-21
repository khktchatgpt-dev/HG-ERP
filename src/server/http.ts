import { NextResponse } from 'next/server'
import { ZodError, type ZodType } from 'zod'

// ---- HTTP errors -----------------------------------------------------------

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
  ) {
    super(message)
  }
}

export const BadRequest = (msg: string, code?: string) => new HttpError(400, msg, code)
export const Unauthorized = (msg = 'Unauthorized') => new HttpError(401, msg)
export const Forbidden = (msg = 'Forbidden') => new HttpError(403, msg)
export const NotFound = (msg = 'Not found') => new HttpError(404, msg)
export const Conflict = (msg: string, code?: string) => new HttpError(409, msg, code)
export const TooManyRequests = (msg = 'Too many requests') => new HttpError(429, msg)

/** Wrap a route handler so thrown HttpError/ZodError become JSON responses. */
export function handle<Args extends unknown[]>(
  fn: (...args: Args) => Promise<Response> | Response,
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await fn(...args)
    } catch (e) {
      if (e instanceof HttpError) {
        return NextResponse.json({ error: e.message, code: e.code }, { status: e.status })
      }
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: 'Validation failed', issues: e.issues },
          { status: 400 },
        )
      }
      console.error('Unhandled route error:', e)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
  }
}

// ---- Request parsing helpers ----------------------------------------------

export async function parseJson<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    throw BadRequest('Invalid JSON body')
  }
  return schema.parse(raw)
}

export function parseQuery<T>(url: URL, schema: ZodType<T>): T {
  const obj: Record<string, string> = {}
  url.searchParams.forEach((v, k) => {
    obj[k] = v
  })
  return schema.parse(obj)
}
