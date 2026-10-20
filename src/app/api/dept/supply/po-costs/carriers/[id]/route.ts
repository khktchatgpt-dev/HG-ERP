import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { poCostsService } from '@/modules/dept/supply/po-costs.service'
import { carrierPatchSchema } from '@/modules/dept/supply/po-costs.schema'

type Ctx = { params: Promise<{ id: string }> }

/** Hồ sơ đơn vị vận chuyển + phiếu của đơn vị đó. */
export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await params
  return NextResponse.json(await poCostsService.carrierDetail(user, id))
})

/** Sửa hồ sơ ngắn của đơn vị (tên, liên hệ, bãi, điều khoản, ngừng dùng). */
export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, carrierPatchSchema)
  return NextResponse.json({
    carrier: await poCostsService.patchCarrier(user, id, input),
  })
})
