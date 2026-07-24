import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { entriesService } from '@/modules/dept/production/entries.service'
import {
  dayLockSchema,
  dayUnlockQuerySchema,
} from '@/modules/dept/production/entries.schema'

/** Chốt sổ ngày (NV xưởng chốt tổ mình; admin/manager chốt tổ chỉ định). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, dayLockSchema)
  await entriesService.lockDay(user, input)
  return NextResponse.json({ ok: true }, { status: 201 })
})

/** Mở khoá sổ đã chốt (?date=&team=) — chỉ admin/manager. */
export const DELETE = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { date, team } = parseQuery(new URL(req.url), dayUnlockQuerySchema)
  await entriesService.unlockDay(user, team, date)
  return NextResponse.json({ ok: true })
})
