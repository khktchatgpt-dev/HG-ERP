import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { diesRepo } from '@/modules/dept/technical/dies.repo'
import { diesService } from '@/modules/dept/technical/dies.service'
import { dieCreateSchema } from '@/modules/dept/technical/dies.schema'

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

/** Thêm một khuôn vào danh mục. Chặn trùng mã ở service (cột code không unique). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const id = await diesService.create(user, await parseJson(req, dieCreateSchema))
  return NextResponse.json({ id }, { status: 201 })
})
