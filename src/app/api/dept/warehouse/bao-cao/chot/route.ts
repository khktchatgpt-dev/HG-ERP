import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { nxtService } from '@/modules/dept/warehouse/nxt.service'
import { chotKySchema } from '@/modules/dept/warehouse/nxt.schema'

/**
 * Chốt sổ kho đến hết một tháng (B2) — `{ thang: 'YYYY-MM', luu_y: string[] }`.
 * Quyền `warehouse.period.close` + kiểm lại điều kiện chặn / lưu ý: service.
 */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, chotKySchema)
  return NextResponse.json(await nxtService.chot(user, input))
})
