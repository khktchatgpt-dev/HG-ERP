import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { theTreoService } from '@/modules/dept/technical/the-treo.service'
import { productTreoTheSchema } from '@/modules/dept/technical/technical.schema'

/** Đánh dấu "đã treo thẻ" cho các SP đang chọn trên màn In thẻ treo. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { ids } = await parseJson(req, productTreoTheSchema)
  return NextResponse.json(await theTreoService.markTagged(user, ids))
})
