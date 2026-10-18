import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { cachTinhService } from '@/modules/dept/hr/cham-cong/cach-tinh.service'
import { banLuuSchema } from '@/modules/dept/hr/cham-cong/cham-cong.schema'

type Ctx = { params: Promise<{ id: string }> }

/** Lưu nháp: quy tắc / khung (Nhân sự) và hệ số (Kế toán). */
export const PATCH = handle(async (req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  const v = await parseJson(req, banLuuSchema)
  await cachTinhService.luu(user, id, v)
  return NextResponse.json({ ok: true })
})

/** Huỷ bản nháp. */
export const DELETE = handle(async (_req: Request, ctx: Ctx) => {
  const user = await authService.requireUser()
  const { id } = await ctx.params
  await cachTinhService.xoaNhap(user, id)
  return NextResponse.json({ ok: true })
})
