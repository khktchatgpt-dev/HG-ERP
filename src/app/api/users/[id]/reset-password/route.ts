import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { usersService } from '@/modules/core/users/users.service'
import { userResetPasswordSchema } from '@/modules/core/users/users.schema'

type Params = { params: Promise<{ id: string }> }

// Admin ép reset mật khẩu cho một user (không gửi email — IT thông báo tay).
export const POST = handle(async (req: Request, { params }: Params) => {
  const actor = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, userResetPasswordSchema)
  await usersService.resetPassword(actor, id, input.new_password, input.reason)
  return NextResponse.json({ ok: true })
})
