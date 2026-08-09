import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poMaterialsRepo } from '@/modules/dept/supply/po-materials.repo'

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  /** Lọc theo nhóm vật tư — 13.064 dòng thì tìm theo tên thôi không đủ hẹp. */
  group: z.string().trim().max(100).optional(),
  /** Nạp lại vật tư của các dòng có sẵn (mở form sửa đơn). */
  ids: z.string().trim().max(8000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
})

/** Ô chọn vật tư của form soạn đơn — tìm ở server (xem po-materials.repo). */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const { q, group, ids, limit } = parseQuery(new URL(req.url), querySchema)

  if (ids) {
    const list = ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    return NextResponse.json({ materials: await poMaterialsRepo.byIds(list) })
  }
  return NextResponse.json({
    materials: await poMaterialsRepo.search({ q, group, limit }),
  })
})
