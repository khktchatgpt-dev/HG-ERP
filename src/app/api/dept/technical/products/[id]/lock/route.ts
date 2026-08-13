import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import {
  productLockSchema,
  productUnlockSchema,
} from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * KHOÁ hồ sơ SP (0140): tuyên bố "bản này dùng được, đừng sửa nữa". Kỹ thuật +
 * Giám đốc (`technical.product.lock`). Đòi đã chọn file BOM đang dùng nếu hồ sơ
 * có file BOM — khoá mà không nói dùng bản nào thì vô nghĩa.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { note } = await parseJson(req, productLockSchema)
  const product = await productsService.lock(user, id, note)
  return NextResponse.json({ product })
})

/** MỞ KHOÁ khi phát sinh — bắt lý do, ghi vết ai mở lúc nào. */
export const DELETE = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { reason } = await parseJson(req, productUnlockSchema)
  const product = await productsService.unlock(user, id, reason)
  return NextResponse.json({ product })
})
