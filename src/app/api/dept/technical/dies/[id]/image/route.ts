import { NextResponse } from 'next/server'
import { z } from 'zod'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { diesService } from '@/modules/dept/technical/dies.service'

type Params = { params: Promise<{ id: string }> }

const bodySchema = z.object({ file_id: z.uuid() })

/**
 * Đặt ảnh mặt cắt cho khuôn. File đã tải lên trước qua `/api/files` với
 * `parent: { kind: 'die', id }`; ở đây chỉ trỏ con trỏ — cùng nếp với ảnh đại
 * diện sản phẩm (`/api/dept/sales/products/[id]/image`).
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { file_id } = await parseJson(req, bodySchema)
  await diesService.setImage(user, id, file_id)
  return NextResponse.json({ ok: true })
})

/** Bỏ ảnh khỏi hồ sơ. File vẫn nằm trên Storage — xem chú thích `setImage`. */
export const DELETE = handle(async (_req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  await diesService.setImage(user, id, null)
  return NextResponse.json({ ok: true })
})
