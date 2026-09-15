import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { blockedService } from '@/modules/dept/warehouse/blocked.service'
import { doiTrangThaiSchema } from '@/modules/dept/warehouse/blocked.schema'

/** Đổi trạng thái của một lượng — C2 mở khoá / C3 khoá lại (0197). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, doiTrangThaiSchema)
  const out = await blockedService.changeStatus(user, {
    ...input,
    bin_id: input.bin_id ?? null,
  })
  return NextResponse.json(out, { status: 201 })
})
