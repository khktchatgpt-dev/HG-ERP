import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'
import { poReopenSchema } from '@/modules/dept/supply/pos.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * MỞ LẠI ĐƠN ĐÃ DUYỆT để sửa: đơn về nháp, dấu duyệt bị xoá, phải duyệt lại.
 * Chặn khi đơn đã có phiếu nhập — xem `posService.reopen`.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, poReopenSchema)
  const po = await posService.reopen(user, id, reason)
  return NextResponse.json({ po })
})
