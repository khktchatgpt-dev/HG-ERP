import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { bomSaveSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/** Đọc BOM của 1 SP (mọi NV — các phòng tham chiếu định mức). */
export const GET = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const result = await productsService.getBom(user, id)
  return NextResponse.json(result)
})

/** Ghi đè trọn bộ BOM (FR-ENG-04 — Kỹ thuật/Sales quản lý). */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { lines } = await parseJson(req, bomSaveSchema)
  const saved = await productsService.saveBom(user, id, lines)
  return NextResponse.json({ lines: saved })
})
