import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stageConfigService } from '@/modules/dept/production/stage-config.service'
import { stageCreateSchema } from '@/modules/dept/production/stage-config.schema'

/** Cấu hình công đoạn (B1, 0287): đọc cả bộ / thêm công đoạn. */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json(await stageConfigService.get(user))
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, stageCreateSchema)
  return NextResponse.json(await stageConfigService.create(user, input), { status: 201 })
})
