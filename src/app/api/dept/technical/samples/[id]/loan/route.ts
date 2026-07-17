import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { loansService } from '@/modules/dept/technical/loans.service'
import { loanCreateSchema } from '@/modules/dept/technical/samples.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, loanCreateSchema)
  const loan = await loansService.create(user, id, input)
  return NextResponse.json({ loan }, { status: 201 })
})
