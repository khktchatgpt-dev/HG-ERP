import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { dayLocksService } from '@/modules/dept/production/day-locks.service'
import {
  dayLockSchema,
  dayUnlockQuerySchema,
} from '@/modules/dept/production/outputs.schema'

/** Chốt sổ ngày (NV xưởng chốt tổ mình; admin/manager chốt tổ chỉ định). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, dayLockSchema)
  const lock = await dayLocksService.lock(user, input)
  return NextResponse.json({ lock }, { status: 201 })
})

/** Mở khoá sổ đã chốt (?date=&team=) — chỉ admin/manager. */
export const DELETE = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { date, team } = parseQuery(new URL(req.url), dayUnlockQuerySchema)
  await dayLocksService.unlock(user, team, date)
  return NextResponse.json({ ok: true })
})
