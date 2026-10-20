import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { spExcelService } from '@/modules/dept/technical/sp-excel.service'
import { spExcelCommitSchema } from '@/modules/dept/technical/sp-excel.schema'

export const maxDuration = 60

/** Ghi một lô ≤ 50 dòng; server soi lại cả file trước khi ghi. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, spExcelCommitSchema)
  return NextResponse.json(await spExcelService.commit(user, input))
})
