import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { stocktakesService } from '@/modules/dept/warehouse/stocktakes.service'
import { stocktakeCountsSchema } from '@/modules/dept/warehouse/stocktakes.schema'

type Params = { params: Promise<{ id: string }> }

/** Ghi số đếm (lưới lưu dở được). `diff` server tính lại, không nhận từ client. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { counts } = await parseJson(req, stocktakeCountsSchema)
  return NextResponse.json(await stocktakesService.saveCounts(user, id, counts))
})
