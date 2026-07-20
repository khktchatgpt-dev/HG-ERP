import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { outputsService } from '@/modules/dept/production/outputs.service'
import { logbookQuerySchema } from '@/modules/dept/production/outputs.schema'

/** Sổ sản lượng toàn xưởng 1 ngày (?date=) + trạng thái chốt sổ các tổ. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { date } = parseQuery(new URL(req.url), logbookQuerySchema)
  const data = await outputsService.listDay(user, date)
  return NextResponse.json(data)
})
