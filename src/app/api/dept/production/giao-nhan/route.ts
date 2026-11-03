import { NextResponse } from 'next/server'
import { handle, parseJson, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { transferDocsService } from '@/modules/dept/production/transfer-docs.service'
import {
  transferDocCreateSchema,
  transferInboxQuerySchema,
} from '@/modules/dept/production/transfer-docs.schema'

/** Hộp giao nhận (0289): mọi phiếu giao tổ của các lệnh đang chạy. */
export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), transferInboxQuerySchema)
  return NextResponse.json(await transferDocsService.inbox(user, { lsxId: q.lsx }))
})

/** Tổ giao lập phiếu → da_giao. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, transferDocCreateSchema)
  const res = await transferDocsService.create(user, input)
  return NextResponse.json({ ok: true, ...res })
})
