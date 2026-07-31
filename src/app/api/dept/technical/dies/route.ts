import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { diesRepo } from '@/modules/dept/technical/dies.repo'

const querySchema = z.object({
  q: z.string().trim().max(200).optional(),
  include_inactive: z.coerce.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(50).default(25),
})

/** Danh mục khuôn nhôm — ô chọn mã khuôn trên dòng đơn mẫu nhôm (kéo theo kg/m). */
export const GET = handle(async (req: Request) => {
  await authService.requireUser()
  const q = parseQuery(new URL(req.url), querySchema)
  return NextResponse.json({ dies: await diesRepo.search(q) })
})
