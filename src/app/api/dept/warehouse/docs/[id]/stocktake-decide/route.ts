import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { stocktakeDecideSchema } from '@/modules/dept/warehouse/warehouse.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Duyệt / từ chối biên bản kiểm kê (0157) — quản lý Kho. Duyệt = áp chênh lệch
 * (số đếm − tồn LÚC DUYỆT) vào sổ; từ chối = đóng biên bản kèm lý do, tồn không
 * đụng. Chặn tự duyệt biên bản mình lập (trừ admin).
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, stocktakeDecideSchema)
  if (input.decision === 'approve') {
    const out = await stockService.approveStocktake(user, id)
    return NextResponse.json(out)
  }
  await stockService.rejectStocktake(user, id, input.reason ?? '')
  return NextResponse.json({ ok: true })
})
