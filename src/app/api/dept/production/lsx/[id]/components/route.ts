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

/** Ghi đè trọn bộ bảng chi tiết — Kế hoạch (KH-CƯ) nhập tay, BOM chỉ tham khảo. */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { lines } = await parseJson(req, componentsSaveSchema)
  await componentsService.save(user, id, lines)
  return NextResponse.json({ ok: true })
})
