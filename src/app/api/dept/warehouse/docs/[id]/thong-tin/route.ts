import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { docInfoSchema } from '@/modules/dept/warehouse/warehouse.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * SỬA THÔNG TIN PHIẾU NHẬP ĐÃ GHI SỔ (02/10/2026, phương án B) — số phiếu giao
 * NCC, người giao, ghi chú. Không đổi tồn; vết vào Trao đổi của đơn mua.
 */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, docInfoSchema)
  return NextResponse.json(await stockService.suaThongTinPhieu(user, id, input))
})
