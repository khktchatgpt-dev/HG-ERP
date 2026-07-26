import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { transfersService } from '@/modules/dept/production/transfers.service'

type Params = { params: Promise<{ id: string }> }

/** Xoá bản ghi bàn giao nhập nhầm — người tạo hoặc GĐ/QL (sổ append-only). */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await transfersService.deleteEntry(user, id)
  return NextResponse.json({ ok: true })
})
