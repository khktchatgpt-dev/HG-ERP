import '@/events/register' // handler vết kg cân → Trao đổi của đơn (warehouse.audit)
import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { kgCanBoSungSchema } from '@/modules/dept/warehouse/warehouse.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * GHI KG CÂN BỔ SUNG vào phiếu nhập đã ghi sổ (01/10/2026) — từ màn Theo dõi
 * đơn hàng › Đã về. Kg là số đo, không đổi tồn; bắt lý do, vết vào Trao đổi.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, kgCanBoSungSchema)
  const out = await stockService.ghiKgCanBoSung(user, id, input)
  return NextResponse.json(out)
})
