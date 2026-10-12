import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { hangLenhService } from '@/modules/dept/warehouse/hang-lenh.service'

type Params = { params: Promise<{ id: string }> }

/**
 * Hàng đã mua cho lệnh, đã về, chưa ghi xuất — "Lấy hàng của lệnh" ở phiếu xuất
 * Kho (Kho đợt 2 · Bước 4). Chỉ đọc.
 */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json({ rows: await hangLenhService.get(user, id) })
})
