import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'

const querySchema = z.object({ po_id: z.string().uuid().optional() })

/**
 * Dữ liệu form nhập theo đơn (FR-WMS-02):
 * - không tham số → danh sách PO đang mở (nhận hàng được)
 * - ?po_id=…      → các dòng của PO đó kèm đặt/đã nhận/còn thiếu (BR-08)
 */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { po_id } = parseQuery(new URL(req.url), querySchema)
  if (po_id) {
    const lines = await stockService.poLines(user, po_id)
    return NextResponse.json({ lines })
  }
  const pos = await stockService.poOptions(user)
  return NextResponse.json({ pos })
})
