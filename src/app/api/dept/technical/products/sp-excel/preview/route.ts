import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { spExcelService } from '@/modules/dept/technical/sp-excel.service'
import { spExcelPreviewSchema } from '@/modules/dept/technical/sp-excel.schema'

export const maxDuration = 60

/** Soi file đã tải lên — không ghi gì. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const { path } = await parseJson(req, spExcelPreviewSchema)
  return NextResponse.json(await spExcelService.preview(user, path))
})
