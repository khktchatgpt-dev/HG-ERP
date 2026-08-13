import { NextResponse } from 'next/server'
import { authService } from '@/modules/core/auth/auth.service'
import { accountService } from '@/modules/core/account/account.service'
import { accountPasswordSchema } from '@/modules/core/account/account.schema'
import { handle, parseJson, TooManyRequests } from '@/server/http'
import { consumeRateLimit, resetRateLimit } from '@/server/rate-limit'

// Đổi mật khẩu phải khai mật khẩu HIỆN TẠI — tức là một ô đoán mò được, ngay
// trên phiên đã đăng nhập (máy bỏ quên không khoá màn hình). Chặn như /api/login.
const LIMIT = { limit: 5, windowMs: 15 * 60_000 }

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, accountPasswordSchema)

  const key = `pwchange:${user.id}`
  const rl = consumeRateLimit(key, LIMIT)
  if (!rl.ok) {
    throw TooManyRequests(
      `Bạn đã nhập sai quá nhiều lần. Thử lại sau ${Math.max(1, Math.ceil(rl.retryAfterSec / 60))} phút.`,
    )
  }

  await accountService.changePassword(user, input)
  resetRateLimit(key)

  return NextResponse.json({ ok: true })
})
