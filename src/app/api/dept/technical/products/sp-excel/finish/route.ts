import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { spExcelService } from '@/modules/dept/technical/sp-excel.service'
import { spExcelFinishSchema } from '@/modules/dept/technical/sp-excel.schema'

/** Điền mã vừa cấp vào chính file người dùng gửi, trả URL tải. */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, spExcelFinishSchema)
  return NextResponse.json(await spExcelService.finish(user, input))
})
