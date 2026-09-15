import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { blockedService } from '@/modules/dept/warehouse/blocked.service'
import { huyHangMacSchema } from '@/modules/dept/warehouse/blocked.schema'

/** Xuất huỷ hàng mắc — X4. Chỉ quản lý / quản trị viên (service gác). */
export const POST = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, huyHangMacSchema)
  const out = await blockedService.scrap(user, { ...input, bin_id: input.bin_id ?? null })
  return NextResponse.json(out, { status: 201 })
})
