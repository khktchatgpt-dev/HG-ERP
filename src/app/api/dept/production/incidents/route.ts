import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { incidentsService } from '@/modules/dept/production/incidents.service'
import {
  incidentCreateSchema,
  incidentListQuerySchema,
} from '@/modules/dept/production/incidents.schema'

/** Danh sách sự cố xưởng (?status=open|resolved). */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { status } = parseQuery(new URL(req.url), incidentListQuerySchema)
  const incidents = await incidentsService.list(user, { status })
  return NextResponse.json({ incidents })
})

/** Tổ báo sự cố (hỏng máy, thiếu vật tư…) — notify quản đốc qua event bus. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, incidentCreateSchema)
  const incident = await incidentsService.report(user, input)
  return NextResponse.json({ incident }, { status: 201 })
})
