import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxSyncSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** Đồng bộ dòng lệnh từ dòng đơn: apply=false xem trước, apply=true áp (sinh bản sửa nếu đã duyệt). */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, lsxSyncSchema)
  return NextResponse.json(await lsxService.syncFromOrders(user, id, input))
})
