import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { lsxService } from '@/modules/dept/production/lsx.service'

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  /** Hạn VẬT TƯ phải về (0126) — null = xoá hạn. */
  materials_due_at: z.string().date().nullable(),
})

/** Đặt "Hạn VT phải về" của lệnh — ô của sổ Tổng hợp ĐH, Cung ứng quản. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { materials_due_at } = await parseJson(req, schema)
  const lsx = await lsxService.setMaterialsDue(user, id, materials_due_at)
  return NextResponse.json({ lsx })
})
