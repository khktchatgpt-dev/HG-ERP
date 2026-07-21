import { NextResponse } from 'next/server'
import { authService } from '@/modules/core/auth/auth.service'
import { handle, parseJson, TooManyRequests } from '@/server/http'
import { loginSchema } from '@/modules/core/auth/auth.schema'
import { consumeRateLimit, resetRateLimit } from '@/server/rate-limit'
import { resolveDefaultWorkspace } from '@/workspaces/resolveWorkspace'

// 5 lần sai / 15 phút cho mỗi cặp (IP, email). Login thành công thì reset.
const LIMIT = { limit: 5, windowMs: 15 * 60_000 }

function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  return fwd?.split(',')[0]?.trim() || 'local'
}

export const POST = handle(async (req: Request) => {
  const input = await parseJson(req, loginSchema)

  const key = `login:${clientIp(req)}:${input.email}`
  const rl = consumeRateLimit(key, LIMIT)
  if (!rl.ok) {
    throw TooManyRequests(
      `Bạn đã nhập sai quá nhiều lần. Thử lại sau ${Math.max(1, Math.ceil(rl.retryAfterSec / 60))} phút.`,
    )
  }

  const user = await authService.login(input)
  resetRateLimit(key)

  // Đưa thẳng vào workspace của user (đỡ 1 vòng redirect qua "/").
  // Workspace chưa ready → "/" tự fallback về dashboard cũ.
  const ws = await resolveDefaultWorkspace(user)
  const redirect = ws?.ready ? `${ws.route}/` : '/'

  return NextResponse.json({ user, redirect })
})
