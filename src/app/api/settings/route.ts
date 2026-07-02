import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { settingsService } from '@/modules/core/settings/settings.service'
import { settingsUpdateSchema } from '@/modules/core/settings/settings.schema'

export const GET = handle(async () => {
  await authService.requireUser()
  return NextResponse.json({ settings: await settingsService.getAll() })
})

export const PATCH = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, settingsUpdateSchema)
  return NextResponse.json({ settings: await settingsService.update(user, input) })
})
