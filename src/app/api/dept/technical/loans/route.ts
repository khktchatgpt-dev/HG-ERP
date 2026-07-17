import { NextResponse } from 'next/server'
import { handle, parseQuery } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { loansService } from '@/modules/dept/technical/loans.service'
import { loanListQuerySchema } from '@/modules/dept/technical/samples.schema'

export const GET = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const q = parseQuery(new URL(req.url), loanListQuerySchema)
  const { rows, total } = await loansService.list(user, q)
  return NextResponse.json({ loans: rows, total })
})
