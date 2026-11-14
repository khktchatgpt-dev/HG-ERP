import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { nxtService } from '@/modules/dept/warehouse/nxt.service'
import { moLaiKySchema } from '@/modules/dept/warehouse/nxt.schema'

/**
 * Mở lại tháng chốt mới nhất của sổ kho (B3) — `{ thang: 'YYYY-MM', ly_do }`.
 * Quyền `warehouse.period.close` + "chỉ tháng mới nhất": service; lý do ≥ 10 ký tự.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, moLaiKySchema)
  return NextResponse.json(await nxtService.moLai(user, input))
})
