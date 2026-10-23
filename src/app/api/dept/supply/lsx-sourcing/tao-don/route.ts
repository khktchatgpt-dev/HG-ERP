import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { keHoachMuaService } from '@/modules/dept/supply/ke-hoach-mua.service'
import { taoDonSchema } from '@/modules/dept/supply/ke-hoach-mua.schema'

/** Kế hoạch mua · bước 3 — tạo mỗi NCC một đơn nháp gắn lệnh. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, taoDonSchema)
  return NextResponse.json(await keHoachMuaService.taoDon(user, input))
})
