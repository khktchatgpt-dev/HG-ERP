import { NextResponse } from 'next/server'
import { handle, parseJson } from '@/server/http'
import { authService } from '@/modules/core/auth/auth.service'
import { productsService } from '@/modules/dept/technical/technical.service'
import { productSetImageSchema } from '@/modules/dept/technical/technical.schema'

type Params = { params: Promise<{ id: string }> }

/**
 * Đặt ảnh đại diện cho SP (ảnh đã upload vào parent product). Dùng khi Kinh doanh
 * tạo nhanh SP + upload ảnh trong lúc làm đơn/báo giá.
 */
export const POST = handle(async (req: Request, { params }: Params) => {
  const user = await authService.requireUser()
  const { id } = await params
  const { file_id } = await parseJson(req, productSetImageSchema)
  const product = await productsService.setMainImage(user, id, file_id)
  return NextResponse.json({
    product: { id: product.id, image_file_id: product.image_file_id },
  })
})
