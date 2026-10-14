import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'

type Params = { params: Promise<{ id: string }> }

/** Số dòng định mức SP / BOM lệnh ghi mã chữ — hộp đổi mã nói trước hệ quả. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const refs = await materialsService.codeRefs(user, id)
  return NextResponse.json({ refs })
})
