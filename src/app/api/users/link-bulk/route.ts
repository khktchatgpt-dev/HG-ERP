import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { nhanVienTaiKhoanService } from '@/modules/core/users/nhan-vien-tai-khoan.service'
import { userLinkBulkSchema } from '@/modules/core/users/users.schema'

// Gắn một loạt tài khoản theo gợi ý khớp họ tên đã soát (0247).
export const POST = handle(async (req: Request) => {
  const actor = await authService.requireUser()
  const { pairs } = await parseJson(req, userLinkBulkSchema)
  return NextResponse.json(await nhanVienTaiKhoanService.ganLoat(actor, pairs))
})
