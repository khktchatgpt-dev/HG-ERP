import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lenhDoiService } from '@/modules/dept/supply/lenh-doi.service'
import { soatSchema } from '@/modules/dept/supply/lenh-doi.schema'

/** Kế hoạch mua · "Đã soát" — ghi mốc soát số cần vật tư của lệnh (0282). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, soatSchema)
  const moc = await lenhDoiService.soat(user, input)
  return NextResponse.json(moc)
})
