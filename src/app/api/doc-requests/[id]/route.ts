import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { docRequestsService } from '@/modules/core/doc-notes/doc-requests.service'
import { requestActionSchema } from '@/lib/doc-requests'

/**
 * MỘT BƯỚC trên yêu cầu việc (0281):
 *   { action: 'done',     text }              — người nhận / người giao báo xong
 *   { action: 'reopen',   text }              — người giao mở lại kèm lý do
 *   { action: 'reassign', assignee_id, text? } — chuyển người nhận
 *   { action: 'cancel',   text }              — người giao huỷ kèm lý do
 *
 * Sai người → 403, sai lúc → 400, hai người bấm cùng lúc → 409 (`actionBlock`).
 */
export const POST = handle(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const user = await authService.requireUser()
    const { id } = await params
    const input = await parseJson(req, requestActionSchema)
    const request = await docRequestsService.act(user, id, input)
    return NextResponse.json({ request })
  },
)
