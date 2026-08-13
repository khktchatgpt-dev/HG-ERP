import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import {
  productBomCheckSchema,
  productBomFileSchema,
} from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * CHỌN FILE BOM ĐANG DÙNG (0140) — hồ sơ có nhiều file BOM qua các lần sửa;
 * đây là chỗ chỉ ra bản nào là bản đúng, UI làm nổi bật hẳn file đó.
 */
export const PUT = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { file_id } = await parseJson(req, productBomFileSchema)
  const product = await productsService.setBomFile(user, id, file_id)
  return NextResponse.json({ product })
})

/** Kỹ thuật TỰ đánh dấu "BOM đã qua kiểm tra" — dấu rà soát, chưa khoá. */
export const PATCH = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { checked } = await parseJson(req, productBomCheckSchema)
  const product = await productsService.markBomChecked(user, id, checked)
  return NextResponse.json({ product })
})
