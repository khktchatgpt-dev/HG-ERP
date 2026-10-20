import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { posService } from '@/modules/dept/supply/pos.service'

type Params = { params: Promise<{ id: string }> }

const schema = z.object({ reason: z.string().trim().min(1, 'Phải ghi lý do') })

/**
 * Hạ đơn ĐÃ GỬI về nháp để sửa dữ liệu nhập sai (15/09/2026).
 *
 * Bốn hàng rào nằm ở `lib/po-reopen.ts` và service kiểm, KHÔNG ở đây — route
 * giữ nguyên vai trò mỏng: đọc phiên, đọc thân, gọi service, trả JSON.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, schema)
  const po = await posService.reopenForEdit(user, id, reason)
  return NextResponse.json({ po })
})
