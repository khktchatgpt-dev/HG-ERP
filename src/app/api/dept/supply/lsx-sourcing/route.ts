import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { keHoachMuaService } from '@/modules/dept/supply/ke-hoach-mua.service'
import {
  chonNccDeleteSchema,
  chonNccUpsertSchema,
} from '@/modules/dept/supply/ke-hoach-mua.schema'

/** Kế hoạch mua · bước 2 — ghi NCC + giá chào đã chọn cho các mã của lệnh (0275). */
export const PUT = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, chonNccUpsertSchema)
  await keHoachMuaService.luuChon(user, input)
  return NextResponse.json({ ok: true })
})

/** Bỏ lựa chọn của một số mã → mã quay về gợi ý của máy. */
export const DELETE = handle(async (req: Request) => {
  const user = await authService.requireUser()
  const input = await parseJson(req, chonNccDeleteSchema)
  await keHoachMuaService.xoaChon(user, input)
  return NextResponse.json({ ok: true })
})
