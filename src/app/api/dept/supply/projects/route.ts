import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { projectsService } from '@/modules/dept/supply/projects.service'
import { projectCreateSchema } from '@/modules/dept/supply/projects.schema'

/** Hạng mục đang mở cho ô "Cho việc" của màn soạn đơn (0230). */
export const GET = handle(async () => {
  await authService.requireUser()
  return NextResponse.json({ projects: await projectsService.options() })
})

/** Tạo hạng mục ngoài sản xuất — từ màn soạn đơn hoặc trang Hạng mục (0230). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, projectCreateSchema)
  const project = await projectsService.create(user, input)
  return NextResponse.json({ project }, { status: 201 })
})
