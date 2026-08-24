import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import {
  dailyTargetsQuerySchema,
  dailyTargetsSaveSchema,
} from '@/modules/dept/production/production.schema'
import { targetsService } from '@/modules/dept/production/targets.service'

/** Chỉ tiêu ngày × tổ × công đoạn (0168): GET ?date= · PUT ghi đè trọn ngày. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { date } = parseQuery(new URL(req.url), dailyTargetsQuerySchema)
  return NextResponse.json(await targetsService.getDay(user, date))
})

export const PUT = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { date, rows } = await parseJson(req, dailyTargetsSaveSchema)
  await targetsService.saveDay(user, date, rows)
  return NextResponse.json({ ok: true })
})
