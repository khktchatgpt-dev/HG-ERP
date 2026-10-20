import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'

type Params = { params: Promise<{ id: string }> }

/** Mã đang nằm ở đâu — panel Sửa dùng để chọn "Xoá mã" hay "Ngừng dùng". */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const usage = await materialsService.usage(user, id)
  return NextResponse.json({ usage })
})
