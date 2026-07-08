import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productionService } from '@/modules/dept/production/production.service'
import {
  productionRepo,
  listLsxLineSpecs,
} from '@/modules/dept/production/production.repo'
import { lsxSpecsSaveSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/** Đọc spec override per dòng LSX (OI-11). */
export const GET = handle(async (_req: Request, { params }: Params) => {
  await authService.requireUser()
  const { id } = await params
  const lsx = await productionRepo.findById(id)
  if (!lsx) return NextResponse.json({ specs: [] })
  const specs = await listLsxLineSpecs(id)
  return NextResponse.json({ specs })
})

/** Sales nhập/ghi đè spec sản xuất per dòng LSX. */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { lines } = await parseJson(req, lsxSpecsSaveSchema)
  await productionService.saveSpecs(
    user,
    id,
    lines.map((l) => ({
      order_line_id: l.order_line_id,
      specs: l.specs,
      note: l.note ?? null,
      important_note: l.important_note ?? null,
    })),
  )
  return NextResponse.json({ ok: true })
})
