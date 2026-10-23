import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { assetsService } from '@/modules/core/assets/assets.service'
import { planCreateSchema } from '@/modules/core/assets/assets.schema'

type Params = { params: Promise<{ id: string }> }

/** Thêm hạng mục bảo trì cho một máy. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await assetsService.addPlan(user, id, await parseJson(req, planCreateSchema))
  return NextResponse.json({ ok: true }, { status: 201 })
})
