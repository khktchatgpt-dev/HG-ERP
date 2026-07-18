import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { routesService, routeSaveSchema } from '@/modules/dept/production/routes.service'

type Params = { params: Promise<{ id: string }> }

/** Lộ trình giai đoạn per dòng SP của LSX — đọc: mọi NV (xưởng xem SP đi qua đâu). */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const data = await routesService.list(user, id)
  return NextResponse.json(data)
})

/** Ghi đè lộ trình của lệnh (định hình) — Kế hoạch/BQL; tuỳ chọn lưu mặc định SP. */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, routeSaveSchema)
  await routesService.save(user, id, input)
  return NextResponse.json({ ok: true })
})
