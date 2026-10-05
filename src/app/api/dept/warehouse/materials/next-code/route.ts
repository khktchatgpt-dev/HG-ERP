import { NextResponse } from 'next/server'
import { handle } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { materialsService } from '@/modules/dept/warehouse/warehouse.service'

/** Mã dự kiến cho vật tư mới của nhóm — ô "Mã vật tư" ở panel Thêm vật tư. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const group = new URL(req.url).searchParams.get('group_name')?.trim() || null
  const code = await materialsService.previewCode(user, group)
  return NextResponse.json({ code })
})
