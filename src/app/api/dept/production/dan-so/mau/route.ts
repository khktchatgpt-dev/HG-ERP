import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery, BadRequest } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { danSoService } from '@/modules/dept/production/dan-so.service'
import { buildMauExcel } from '@/modules/dept/production/dan-so-mau.excel'

/** Tải tờ mẫu Dán sổ Excel (B3) — theo lệnh × công đoạn × tổ (× mã hàng). */
const querySchema = z.object({
  lsx_id: z.string().uuid(),
  stage: z.string().min(1),
  team_id: z.string().uuid(),
  line_id: z.string().uuid().optional(),
})

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), querySchema)
  const m = await danSoService.mau(user, q)
  if (m.to.length === 0) throw BadRequest('Lệnh chưa có dòng sản phẩm')
  const buf = await buildMauExcel(m.to)
  const filename = `mau-dan-so_${m.lsx_code.replace(/[^\w.-]+/g, '-')}_${q.stage}.xlsx`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
})
