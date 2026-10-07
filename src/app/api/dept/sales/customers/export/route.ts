import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { salesService } from '@/modules/dept/sales/sales.service'
import { customerListQuerySchema } from '@/modules/dept/sales/sales.schema'
import { buildCustomersExcel } from '@/modules/dept/sales/customers-excel'

/** Tải sổ khách hàng .xlsx theo đúng bộ lọc đang xem (tối đa 1000 khách). */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), customerListQuerySchema)
  const { rows } = await salesService.list(user, {
    q: q.q,
    owner_id: q.owner_id,
    unassigned: q.unassigned,
    status: q.status,
    sort: q.sort,
    page: 1,
    page_size: 1000,
  })
  const activity = await salesService.activity(user, rows.map((c) => c.id))
  const buf = await buildCustomersExcel(rows, activity)
  const filename = `Khach-hang_${new Date().toISOString().slice(0, 10)}.xlsx`
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'no-store',
    },
  })
})
