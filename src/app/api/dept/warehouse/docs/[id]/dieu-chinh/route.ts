import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { docAdjustSchema } from '@/modules/dept/warehouse/warehouse.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * ĐIỀU CHỈNH CHÊNH LỆCH PHIẾU NHẬP ĐÃ GHI SỔ (02/10/2026, phương án C) — hàng đã
 * dùng nên không đảo được: ghi PNK bổ sung / PXK điều chỉnh đúng phần lệch.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, docAdjustSchema)
  return NextResponse.json(await stockService.dieuChinhPhieuNhap(user, id, input))
})
