import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { deNghiSaveSchema } from '@/modules/dept/warehouse/de-nghi.schema'
import { deNghiService } from '@/modules/dept/warehouse/de-nghi.service'

/** Sổ đề nghị mua vật tư (0236) + lập phiếu mới (nháp). */
export const GET = handle(async () => {
  const user = await authService.requireUser()
  return NextResponse.json({ rows: await deNghiService.list(user) })
})

export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, deNghiSaveSchema)
  return NextResponse.json(await deNghiService.create(user, input), { status: 201 })
})
