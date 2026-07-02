import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { leaveService } from '@/modules/dept/hr/hr.service'
import { leaveDecideSchema } from '@/modules/dept/hr/hr.schema'
import { z } from 'zod'

type Params = { params: Promise<{ id: string }> }

const actionSchema = z.object({
  action: z.enum(['approve', 'reject', 'cancel']),
  approver_note: z.string().trim().max(1000).optional(),
})

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { action, approver_note } = await parseJson(req, actionSchema)
  let request
  if (action === 'cancel') {
    request = await leaveService.cancel(user, id)
  } else {
    request = await leaveService.decide(user, id, action, approver_note)
  }
  return NextResponse.json({ request })
})
