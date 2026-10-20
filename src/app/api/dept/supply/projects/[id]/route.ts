import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { projectsService } from '@/modules/dept/supply/projects.service'
import { projectUpdateSchema } from '@/modules/dept/supply/projects.schema'

type Params = { params: Promise<{ id: string }> }

/** Sửa tên / loại / dự toán / ghi chú, hoặc đóng / mở lại hạng mục (0230). */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, projectUpdateSchema)
  await projectsService.update(user, id, input)
  return NextResponse.json({ ok: true })
})
