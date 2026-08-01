import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poMaterialsRepo } from '@/modules/dept/supply/po-materials.repo'
import { PO_TEMPLATES } from '@/lib/po-template'

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  /** Lọc theo mẫu đơn đang soạn — vật tư chưa khai mẫu vẫn hiện. */
  template: z.enum(PO_TEMPLATES).optional(),
  /** Nạp lại vật tư của các dòng có sẵn (mở form sửa đơn). */
  ids: z.string().trim().max(8000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
})

/** Ô chọn vật tư của form soạn đơn — tìm ở server (xem po-materials.repo). */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { q, template, ids, limit } = parseQuery(new URL(req.url), querySchema)

  if (ids) {
    const list = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return NextResponse.json({ materials: await poMaterialsRepo.byIds(list) })
  }
  return NextResponse.json({
    materials: await poMaterialsRepo.search({ q, template, limit }),
  })
})
