import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { loansService } from '@/modules/dept/technical/loans.service'
import { loanReturnSchema } from '@/modules/dept/technical/samples.schema'

type Params = { params: Promise<{ id: string }> }

export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, loanReturnSchema)
  const loan = await loansService.return(user, id, input)
  return NextResponse.json({ loan })
})
