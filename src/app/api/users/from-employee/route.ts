import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { nhanVienTaiKhoanService } from '@/modules/core/users/nhan-vien-tai-khoan.service'
import { userFromEmployeeSchema } from '@/modules/core/users/users.schema'

// Cấp tài khoản cá nhân từ dòng nhân viên (0247).
export const POST = handle(async (req: Request) => {
  const actor = await authService.requireUser()
  const input = await parseJson(req, userFromEmployeeSchema)
  const user = await nhanVienTaiKhoanService.capTuNhanVien(actor, input)
  return NextResponse.json({ user }, { status: 201 })
})
