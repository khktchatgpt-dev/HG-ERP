import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { componentsService } from '@/modules/dept/production/components.service'
import { componentsSaveSchema } from '@/modules/dept/production/components.schema'

type Params = { params: Promise<{ id: string }> }

/** Bảng chi tiết của LSX — đọc: mọi NV (xưởng/kho/GĐ tra cứu). */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await componentsService.list(user, id)
  return NextResponse.json(data)
})

/** Ghi đè trọn bộ bảng chi tiết — Kế hoạch (KH-CƯ) nhập tay, BOM chỉ tham khảo.
 *  `seed_profile` nhập ngược lên hồ sơ SP chưa có định mức (user chốt 23/08). */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { lines, seed_profile } = await parseJson(req, componentsSaveSchema)
  const result = await componentsService.save(user, id, lines, {
    seedProfile: seed_profile,
  })
  return NextResponse.json({ ok: true, ...result })
})
