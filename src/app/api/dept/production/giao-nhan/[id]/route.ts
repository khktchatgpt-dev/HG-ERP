import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { transferDocsService } from '@/modules/dept/production/transfer-docs.service'
import { transferDocActionSchema } from '@/modules/dept/production/transfer-docs.schema'

type Params = { params: Promise<{ id: string }> }

/** Nhận · huỷ · đảo một phiếu giao tổ — phân biệt bằng `action`. */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, transferDocActionSchema)
  const res = await transferDocsService.act(user, id, input)
  return NextResponse.json({ ok: true, ...res })
})
