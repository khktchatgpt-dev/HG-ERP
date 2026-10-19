import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { nhanVienTaiKhoanService } from '@/modules/core/users/nhan-vien-tai-khoan.service'
import { userLinkSchema } from '@/modules/core/users/users.schema'

type Params = { params: Promise<{ id: string }> }

// Gắn / gỡ tài khoản ↔ nhân viên, hoặc đánh dấu dùng chung (0247).
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const actor = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, userLinkSchema)
  const user =
    'shared' in input
      ? await nhanVienTaiKhoanService.dungChung(actor, id, input.holder)
      : await nhanVienTaiKhoanService.gan(actor, id, input.employee_id)
  return NextResponse.json({ user })
})
