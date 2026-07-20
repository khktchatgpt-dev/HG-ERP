import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { defectCodesService } from '@/modules/dept/production/defect-codes.service'
import { defectCodeCreateSchema } from '@/modules/dept/production/defect-codes.schema'

/** Admin tạo nguyên nhân lỗi SX mới (code bất biến sau tạo). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, defectCodeCreateSchema)
  const item = await defectCodesService.create(user, input)
  return NextResponse.json({ item }, { status: 201 })
})
