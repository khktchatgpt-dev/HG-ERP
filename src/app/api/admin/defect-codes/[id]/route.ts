import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { defectCodesService } from '@/modules/dept/production/defect-codes.service'
import { defectCodeUpdateSchema } from '@/modules/dept/production/defect-codes.schema'

type Params = { params: Promise<{ id: string }> }

/** Admin sửa label/công đoạn/thứ tự/ẩn-hiện — KHÔNG sửa code (sổ tham chiếu). */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const input = await parseJson(req, defectCodeUpdateSchema)
  const item = await defectCodesService.update(user, id, input)
  return NextResponse.json({ item })
})
