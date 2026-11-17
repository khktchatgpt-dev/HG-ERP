import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { danSoService } from '@/modules/dept/production/dan-so.service'
import { danSoSchema } from '@/modules/dept/production/dan-so.schema'

/**
 * Dán sổ Excel (bản vẽ 17/11/2026). `xem` = tính xem trước, không ghi gì;
 * `ghi` = tính lại rồi ghi — mỗi ngày một phiếu nhập bù qua `entriesService.record`.
 */
const bodySchema = z.object({ mode: z.enum(['xem', 'ghi']), data: danSoSchema })

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { mode, data } = await parseJson(req, bodySchema)
  const res =
    mode === 'xem' ? await danSoService.xem(user, data) : await danSoService.ghi(user, data)
  return NextResponse.json(res)
})
