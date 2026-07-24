import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import {
  issueLsxSchema,
  lsxListQuerySchema,
} from '@/modules/dept/production/production.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), lsxListQuerySchema)
  const result = await lsxService.list(user, q)
  return NextResponse.json(result)
})

/** Phát LSX từ đơn hàng (FR-SAL-06 — BR-01 DB chặn trùng). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, issueLsxSchema)
  const lsx = await lsxService.issue(user, input)
  return NextResponse.json({ lsx }, { status: 201 })
})
