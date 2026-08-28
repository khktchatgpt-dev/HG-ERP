import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'

type Params = { params: Promise<{ id: string }> }

/** Sổ vết thay đổi của MỘT vật tư (0177) — nuôi hộp "Lịch sử" ở màn danh mục. */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const changes = await materialsService.changes(user, id)
  return NextResponse.json({ changes })
})
