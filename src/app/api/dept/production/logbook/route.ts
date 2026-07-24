import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import { logbookQuerySchema } from '@/modules/dept/production/entries.schema'

/** Sổ số liệu toàn xưởng 1 ngày (?date=) + trạng thái chốt sổ các tổ. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { date } = parseQuery(new URL(req.url), logbookQuerySchema)
  const data = await entriesService.listDay(user, date)
  return NextResponse.json(data)
})
