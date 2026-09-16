import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stockService } from '@/modules/dept/warehouse/stock.service'
import { docReverseSchema } from '@/modules/dept/warehouse/warehouse.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * PHIẾU ĐẢO (0161/K1): ghi ngược toàn bộ movement của phiếu ghi sai — không
 * sửa đè, không xoá. Mỗi phiếu đảo một lần; guard tồn khi đảo PNK; PO/đợt tự
 * lùi trạng thái; notify quản lý Kho + người phụ trách đơn.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, docReverseSchema)
  const out = await stockService.reverseDoc(user, id, reason)
  return NextResponse.json(out, { status: 201 })
})
