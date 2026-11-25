import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { phuTrachService } from '@/modules/dept/warehouse/phu-trach.service'
import { luuPhuTrachSchema } from '@/modules/dept/warehouse/phu-trach.schema'

/** Thủ kho lưu phân công nhóm vật tư → nhân viên Kho (0305). */
export const PUT = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, luuPhuTrachSchema)
  return NextResponse.json(await phuTrachService.luu(user, input))
})
