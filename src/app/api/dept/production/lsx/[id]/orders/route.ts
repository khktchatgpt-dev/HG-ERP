import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxOrdersSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** Gộp thêm đơn vào lệnh đang chạy (0113). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { order_ids } = await parseJson(req, lsxOrdersSchema)
  const lsx = await lsxService.addOrders(user, id, order_ids)
  return NextResponse.json({ lsx })
})

/** Gỡ đơn khỏi lệnh — đơn quay về Xác nhận, chờ xếp vào lệnh khác (0113). */
export const DELETE = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { order_ids } = await parseJson(req, lsxOrdersSchema)
  const lsx = await lsxService.removeOrders(user, id, order_ids)
  return NextResponse.json({ lsx })
})
