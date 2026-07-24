import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'
import { lsxCompleteSchema } from '@/modules/dept/production/production.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Hoàn thành LSX → đơn 'completed' (FR-PROD-03). GATE: mọi công việc đã
 * xong; QL được ép qua (override) kèm lý do.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, lsxCompleteSchema)
  const lsx = await lsxService.complete(user, id, input)
  return NextResponse.json({ lsx })
})
